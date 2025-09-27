import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseJsonResponse, handleApiResponse } from './api-helpers';

describe('API Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('parseJsonResponse', () => {
    it('should parse valid JSON response', async () => {
      const mockData = { success: true, data: 'test' };
      const response = new Response(JSON.stringify(mockData), {
        headers: { 'content-type': 'application/json' },
      });

      const result = await parseJsonResponse(response);
      expect(result).toEqual(mockData);
    });

    it('should throw error for HTML response', async () => {
      const htmlContent = '<!DOCTYPE html><html><body>404 Not Found</body></html>';
      const response = new Response(htmlContent, {
        headers: { 'content-type': 'text/html' },
      });

      await expect(parseJsonResponse(response)).rejects.toThrow(
        'Invalid response format from server - expected JSON but received HTML'
      );
      expect(console.error).toHaveBeenCalledWith(
        'Non-JSON response received%s:',
        '',
        expect.stringContaining('<!DOCTYPE html>')
      );
    });

    it('should throw error when content-type is missing', async () => {
      const response = new Response('Some text content', {
        headers: {},
      });

      await expect(parseJsonResponse(response)).rejects.toThrow(
        'Invalid response format from server - expected JSON but received HTML'
      );
    });

    it('should include context in error message when provided', async () => {
      const response = new Response('Error page', {
        headers: { 'content-type': 'text/plain' },
      });

      await expect(parseJsonResponse(response, 'test-context')).rejects.toThrow(
        'Invalid response format from server - expected JSON but received HTML'
      );
      expect(console.error).toHaveBeenCalledWith(
        'Non-JSON response received%s:',
        ' (test-context)',
        'Error page'
      );
    });

    it('should handle application/json with charset', async () => {
      const mockData = { test: 'data' };
      const response = new Response(JSON.stringify(mockData), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });

      const result = await parseJsonResponse(response);
      expect(result).toEqual(mockData);
    });
  });

  describe('handleApiResponse', () => {
    it('should return parsed JSON for successful response', async () => {
      const mockData = { success: true, id: '123' };
      const response = new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const result = await handleApiResponse(response);
      expect(result).toEqual(mockData);
    });

    it('should throw error with server message for error response', async () => {
      const errorData = { message: 'Repository not found' };
      const response = new Response(JSON.stringify(errorData), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Repository not found');
    });

    it('should throw generic error for error response without message', async () => {
      const errorData = { error: 'SOME_ERROR_CODE' };
      const response = new Response(JSON.stringify(errorData), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Request failed with status 500');
    });

    it('should handle HTML error pages gracefully', async () => {
      const htmlError = '<!DOCTYPE html><html><body>503 Service Unavailable</body></html>';
      const response = new Response(htmlError, {
        status: 503,
        headers: { 'content-type': 'text/html' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Request failed with status 503');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      // Simulate a network error with status 500 (as status 0 is not valid in Response constructor)
      const response = new Response('Network error occurred', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'text/plain' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Request failed with status 500');
    });

    it('should handle 401 unauthorized with JSON error', async () => {
      const errorData = { message: 'Please login to continue' };
      const response = new Response(JSON.stringify(errorData), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Please login to continue');
    });

    it('should handle rate limit errors', async () => {
      const errorData = { message: 'Rate limit exceeded', retryAfter: 60 };
      const response = new Response(JSON.stringify(errorData), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });

      await expect(handleApiResponse(response)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
