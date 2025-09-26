/**
 * Utility functions for API response handling
 */

// Generic type for JSON response data
export type JsonResponse = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * Safely parse JSON response, with special handling for error responses
 * that might be HTML (e.g., 404 pages) instead of JSON
 *
 * @param response - The fetch Response object
 * @param context - Optional context for better error messages
 * @returns Parsed JSON object
 * @throws Error if response is not JSON
 */
export async function parseJsonResponse<T = JsonResponse>(
  response: Response,
  context?: string
): Promise<T> {
  const contentType = response.headers.get('content-type');

  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    const contextMsg = context ? ` (${context})` : '';
    console.error('Non-JSON response received%s:', contextMsg, text.substring(0, 200));
    throw new Error('Invalid response format from server - expected JSON but received HTML');
  }

  return response.json();
}

/**
 * Handle API response with proper error checking and JSON parsing
 *
 * @param response - The fetch Response object
 * @param context - Optional context for better error messages
 * @returns Parsed JSON for successful responses
 * @throws Error with message from server or generic error
 */
export async function handleApiResponse<T = JsonResponse>(
  response: Response,
  context?: string
): Promise<T> {
  if (!response.ok) {
    // Try to parse error response as JSON, but handle HTML error pages
    let errorData;
    try {
      errorData = await parseJsonResponse<{ message?: string }>(response, context);
    } catch {
      // If we can't parse as JSON, throw a generic error with status
      throw new Error(`Request failed with status ${response.status}`);
    }

    // Throw error with message from server if available
    throw new Error(errorData?.message || `Request failed with status ${response.status}`);
  }

  // Parse successful response
  return response.json();
}
