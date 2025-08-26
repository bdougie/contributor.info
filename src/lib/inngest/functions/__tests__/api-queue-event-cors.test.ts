import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pure function to generate CORS headers
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Pure function to validate request method
export function isValidMethod(method: string): boolean {
  return method === 'POST' || method === 'OPTIONS';
}

// Pure function to create response headers
export function createResponseHeaders(
  contentType: string | null,
  includeCors: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (includeCors) {
    Object.assign(headers, getCorsHeaders());
  }

  return headers;
}

describe('API Queue Event CORS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCorsHeaders', () => {
    it('should return correct CORS headers', () => {
      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
      expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    });
  });

  describe('isValidMethod', () => {
    it('should allow POST method', () => {
      expect(isValidMethod('POST')).toBe(true);
    });

    it('should allow OPTIONS method', () => {
      expect(isValidMethod('OPTIONS')).toBe(true);
    });

    it('should reject GET method', () => {
      expect(isValidMethod('GET')).toBe(false);
    });

    it('should reject PUT method', () => {
      expect(isValidMethod('PUT')).toBe(false);
    });
  });

  describe('createResponseHeaders', () => {
    it('should include content type when provided', () => {
      const headers = createResponseHeaders('application/json', false);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers when requested', () => {
      const headers = createResponseHeaders(null, true);
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include both content type and CORS', () => {
      const headers = createResponseHeaders('application/json', true);
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
