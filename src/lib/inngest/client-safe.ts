/**
 * Queue a background job.
 *
 * Every caller that used to `inngest.send({ name, data })` goes through here.
 * The request is a POST to the `queue-event` Supabase Edge Function, which
 * routes the event to a gh-datapipe machine (`capture/*`) or to the pgmq
 * `jobs` queue (everything else). See docs/infrastructure/jobs-queue.md.
 *
 * In the browser the request carries the anon key; on a server (Netlify
 * function, webhook background function) it carries the service-role key when
 * one is in the environment. There is no direct-to-Inngest path any more.
 *
 * The function keeps its historical name so the many call sites did not have
 * to change in the same PR as the transport; `queueEvent` is the same thing.
 */

import { env } from '../env';
import { logger } from '../logger';

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

// Circuit breaker state for each endpoint
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const FAILURE_THRESHOLD = 3; // Open circuit after 3 failures
const RESET_TIMEOUT = 60000; // Try again after 60 seconds

function shouldAttemptEndpoint(endpointName: string): boolean {
  const breaker = circuitBreakers.get(endpointName);
  if (!breaker || breaker.state === 'closed') return true;
  if (breaker.state === 'open') {
    if (Date.now() - breaker.lastFailureTime >= RESET_TIMEOUT) {
      breaker.state = 'half-open';
      breaker.failures = 0;
      return true;
    }
    return false;
  }
  return true;
}

function recordSuccess(endpointName: string): void {
  const breaker = circuitBreakers.get(endpointName);
  if (breaker && breaker.state === 'half-open') {
    circuitBreakers.delete(endpointName);
  }
}

function recordFailure(endpointName: string): void {
  const breaker = circuitBreakers.get(endpointName) || {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed' as const,
  };
  breaker.failures++;
  breaker.lastFailureTime = Date.now();
  if (breaker.failures >= FAILURE_THRESHOLD) {
    breaker.state = 'open';
    console.warn('Circuit breaker opened for %s after %s failures', endpointName, breaker.failures);
  }
  circuitBreakers.set(endpointName, breaker);
}

/**
 * Generate a unique idempotency key for a request
 */
export function generateIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Server-side callers authenticate with the service-role key when present. */
function serverKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

interface Endpoint {
  url: string;
  headers: Record<string, string>;
  name: string;
}

function endpointsFor(idempotencyKey: string): Endpoint[] {
  const key = (!isBrowser() && serverKey()) || SUPABASE_ANON_KEY;
  const authHeaders: Record<string, string> = key
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : {};
  const endpoints: Endpoint[] = [];
  if (SUPABASE_URL) {
    endpoints.push({
      url: `${SUPABASE_URL}/functions/v1/queue-event`,
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        ...authHeaders,
      },
      name: 'Supabase Edge Function',
    });
  }
  if (isBrowser()) {
    // Same function behind the site's /api redirect (netlify.toml)
    endpoints.push({
      url: '/api/queue-event',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
      name: 'Netlify redirect',
    });
  }
  return endpoints;
}

export interface QueueEventResult {
  ids?: string[];
  idempotencyKey?: string;
  duplicate?: boolean;
  retired?: boolean;
}

/**
 * Queue an event with idempotency support.
 *
 * @param event - The event to send with name and data
 * @param options - Optional configuration including idempotency key
 */
export async function sendInngestEvent<T extends { name: string; data: Record<string, unknown> }>(
  event: T,
  options?: { idempotencyKey?: string }
): Promise<QueueEventResult> {
  const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey();
  const endpoints = endpointsFor(idempotencyKey);

  if (endpoints.length === 0) {
    throw new Error('SUPABASE_URL is not configured; cannot queue events');
  }

  let lastError: Error | null = null;
  let attemptedEndpoints = 0;

  for (const endpoint of endpoints) {
    if (!shouldAttemptEndpoint(endpoint.name)) {
      console.debug('Circuit breaker open for %s, skipping', endpoint.name);
      continue;
    }
    attemptedEndpoints++;

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: endpoint.headers,
        body: JSON.stringify({ eventName: event.name, data: event.data }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to queue event: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.duplicate) {
        logger.log('Duplicate request detected via %s, returning cached response', endpoint.name);
      } else if (result.retired) {
        logger.log('Event %s is retired; acknowledged by %s', event.name, endpoint.name);
      } else {
        logger.log('Event %s queued via %s', event.name, endpoint.name);
      }
      recordSuccess(endpoint.name);

      return {
        ids: result.eventId ? [result.eventId] : result.eventIds || [],
        idempotencyKey,
        duplicate: result.duplicate || false,
        retired: result.retired || false,
      };
    } catch (error) {
      console.warn('Failed to send event via %s:', endpoint.name, error);
      lastError = error as Error;
      recordFailure(endpoint.name);
    }
  }

  if (attemptedEndpoints === 0) {
    throw new Error('All event endpoints are temporarily unavailable. Please try again later.');
  }
  throw lastError || new Error('Failed to send event to any endpoint');
}

/** Same as sendInngestEvent; the name that matches what it does now. */
export const queueEvent = sendInngestEvent;
