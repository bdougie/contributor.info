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

/**
 * Send an event to Inngest in a client-safe way
 * 
 * @param event - The event to send with name and data
 * @returns Promise that resolves when the event is sent
 */
export async function sendInngestEvent<T extends { name: string; data: any }>(
  event: T
): Promise<{ ids?: string[] }> {
  // In browser context, use the API endpoint
  if (typeof window !== 'undefined') {
    // Try Supabase first, fallback to Netlify if it fails
    const endpoints = [
      {
        url: `${SUPABASE_URL}/functions/v1/queue-event`,
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { 'apikey': SUPABASE_ANON_KEY } : {}),
          ...(SUPABASE_ANON_KEY ? { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } : {})
        },
        name: 'Supabase Edge Function'
      },
      {
        url: '/api/queue-event',
        headers: {
          'Content-Type': 'application/json',
        },
        name: 'Netlify Function'
      }
    ];

    let lastError: Error | null = null;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify({
            eventName: event.name,
            data: event.data
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to queue event: ${response.statusText}`
          );
        }
        
        const result = await response.json();
        console.log(`Event sent successfully via ${endpoint.name}`);
        return { ids: result.eventId ? [result.eventId] : result.eventIds || [] };
      } catch (error) {
        console.warn(`Failed to send event via ${endpoint.name}:`, error);
        lastError = error as Error;
        // Continue to next endpoint
      }
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