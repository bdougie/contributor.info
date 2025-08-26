/**
 * Client-safe wrapper for sending Inngest events
 *
 * This module provides a safe way to send events to Inngest from both
 * client and server environments. In the browser, it uses the Supabase Edge Function
 * to avoid exposing the event key. On the server, it sends directly.
 */

import { inngest } from './client';

// Import env helper for consistent environment variable access
import { env } from '../env';

// Get Supabase URL from environment
const SUPABASE_URL = env.SUPABASE_URL;

// Get Supabase anon key for Edge Function auth
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

// Circuit breaker state for each endpoint
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3; // Open circuit after 3 failures
const RESET_TIMEOUT = 60000; // Try again after 60 seconds

/**
 * Check if an endpoint should be attempted based on circuit breaker state
 */
function shouldAttemptEndpoint(endpointName: string): boolean {
  const breaker = circuitBreakers.get(endpointName);

  if (!breaker) {
    // No breaker state, endpoint is available
    return true;
  }

  if (breaker.state === 'closed') {
    return true;
  }

  if (breaker.state === 'open') {
    // Check if enough time has passed to try again
    const timeSinceLastFailure = Date.now() - breaker.lastFailureTime;
    if (timeSinceLastFailure >= RESET_TIMEOUT) {
      // Move to half-open state
      breaker.state = 'half-open';
      breaker.failures = 0;
      return true;
    }
    return false;
  }

  // Half-open state - allow the attempt
  return true;
}

/**
 * Record a successful call to an endpoint
 */
function recordSuccess(endpointName: string): void {
  const breaker = circuitBreakers.get(endpointName);

  if (breaker && breaker.state === 'half-open') {
    // Reset to closed state after successful call in half-open state
    circuitBreakers.delete(endpointName);
  }
}

/**
 * Record a failed call to an endpoint
 */
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
 * Send an event to Inngest in a client-safe way
 *
 * @param event - The event to send with name and data
 * @returns Promise that resolves when the event is sent
 */
export async function sendInngestEvent<T extends { name: string; data: Record<string, unknown> }>(
  event: T,
): Promise<{ ids?: string[] }> {
  // In browser context, use the API endpoint
  if (typeof window !== 'undefined') {
    // Try Supabase first, fallback to Netlify if it fails
    const endpoints = [
      {
        url: `${SUPABASE_URL}/functions/v1/queue-event`,
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
          ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        },
        name: 'Supabase Edge Function',
      },
      {
        url: '/api/queue-event',
        headers: {
          'Content-Type': 'application/json',
        },
        name: 'Netlify Function',
      },
    ];

    let lastError: Error | null = null;
    let attemptedEndpoints = 0;

    for (const endpoint of endpoints) {
      // Check circuit breaker before attempting
      if (!shouldAttemptEndpoint(endpoint.name)) {
        console.debug('Circuit breaker open for %s, skipping', endpoint.name);
        continue;
      }

      attemptedEndpoints++;

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify({
            eventName: event.name,
            data: event.data,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to queue event: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Event sent successfully via %s', endpoint.name);

        // Record success for circuit breaker
        recordSuccess(endpoint.name);

        return { ids: result.eventId ? [result.eventId] : result.eventIds || [] };
      } catch (error) {
        console.warn('Failed to send event via %s:', endpoint.name, error);
        lastError = error as Error;

        // Record failure for circuit breaker
        recordFailure(endpoint.name);

        // Continue to next endpoint
      }
    }

    // Check if all endpoints were skipped due to circuit breakers
    if (attemptedEndpoints === 0) {
      console.error('All endpoints are unavailable due to circuit breakers');
      throw new Error('All event endpoints are temporarily unavailable. Please try again later.');
    }

    // If all endpoints failed, throw the last error
    console.error('All endpoints failed to send event');
    throw lastError || new Error('Failed to send event to any endpoint');
  }

  // Server-side: send directly to Inngest
  return inngest.send(event);
}

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Re-export the Inngest instance for server-side use only
 * Do not use this directly in browser code!
 */
export { inngest as serverInngest };
