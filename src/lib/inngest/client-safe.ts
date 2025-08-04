/**
 * Client-safe wrapper for sending Inngest events
 * 
 * This module provides a safe way to send events to Inngest from both
 * client and server environments. In the browser, it uses the API endpoint
 * to avoid exposing the event key. On the server, it sends directly.
 */

import { inngest } from './client';

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
    try {
      const response = await fetch('/api/queue-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      return { ids: result.eventId ? [result.eventId] : [] };
    } catch (error) {
      console.error('Failed to send event via API:', error);
      throw error;
    }
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