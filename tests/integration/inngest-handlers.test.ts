import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve } from '@netlify/functions';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';

// Test helper to create mock Netlify event
function createMockEvent(options: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: options.httpMethod || 'GET',
    path: options.path || '/.netlify/functions/inngest',
    headers: options.headers || { host: 'localhost:8888' },
    body: options.body || null,
    isBase64Encoded: false,
    rawUrl: '',
    rawQuery: '',
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
  };
}

// Test helper to create mock context
function createMockContext(): HandlerContext {
  return {
    functionName: 'inngest',
    functionVersion: '1.0',
    invokedFunctionArn: '',
    memoryLimitInMB: '1024',
    awsRequestId: 'test-request-id',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
    clientContext: undefined,
    identity: undefined,
    callbackWaitsForEmptyEventLoop: false,
  };
}

describe('Inngest Handler Integration Tests', () => {
  describe('Development Handler (inngest.mts)', () => {
    let handler: any;

    beforeAll(async () => {
      // Dynamically import to test module loading
      try {
        const module = await import('../../netlify/functions/inngest.mts');
        handler = module.default || module.handler;
      } catch (error) {
        console.error('Failed to import inngest.mts:', error);
      }
    });

    it('should export a handler function', () => {
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should handle GET requests with status page', async () => {
      const event = createMockEvent({ httpMethod: 'GET' });
      const context = createMockContext();
      
      const response = await handler(event, context);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Inngest');
      expect(body.functions).toBeInstanceOf(Array);
    });

    it('should handle POST requests for Inngest events', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        headers: {
          host: 'localhost:8888',
          'content-type': 'application/json',
          'x-inngest-signature': 'test-signature',
        },
        body: JSON.stringify({
          name: 'test/event',
          data: { test: true },
        }),
      });
      const context = createMockContext();
      
      // This might fail without proper Inngest setup, but we're testing that it doesn't crash
      const response = await handler(event, context);
      
      expect(response).toBeDefined();
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('Production Handler (inngest-prod.mts)', () => {
    let handler: any;

    beforeAll(async () => {
      // Set production environment
      process.env.NODE_ENV = 'production';
      process.env.CONTEXT = 'production';
      
      try {
        const module = await import('../../netlify/functions/inngest-prod.mts');
        handler = module.default || module.handler;
      } catch (error) {
        console.error('Failed to import inngest-prod.mts:', error);
      }
    });

    afterAll(() => {
      // Reset environment
      delete process.env.NODE_ENV;
      delete process.env.CONTEXT;
    });

    it('should export a handler function', () => {
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should handle GET requests with production status', async () => {
      const event = createMockEvent({ httpMethod: 'GET' });
      const context = createMockContext();
      
      const response = await handler(event, context);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.environment?.isProduction).toBe(true);
    });
  });

  describe('Import Path Validation', () => {
    it('should successfully import all Inngest functions', async () => {
      // This test ensures the import paths are correct
      const imports = [
        import('../../src/lib/inngest/functions/index-without-embeddings'),
        import('../../src/lib/inngest/client'),
        import('../../netlify/functions/inngest-prod-functions'),
      ];

      const results = await Promise.allSettled(imports);
      
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'rejected') {
          console.error(`Import ${index} failed:`, result.reason);
        }
      });
    });
  });

  describe('Handler Export Consistency', () => {
    it('should have consistent export patterns between dev and prod', async () => {
      const devModule = await import('../../netlify/functions/inngest.mts');
      const prodModule = await import('../../netlify/functions/inngest-prod.mts');

      // Both should have either default or handler export
      const devHasDefault = 'default' in devModule;
      const devHasHandler = 'handler' in devModule;
      const prodHasDefault = 'default' in prodModule;
      const prodHasHandler = 'handler' in prodModule;

      // They should have the same export structure
      expect(devHasDefault).toBe(prodHasDefault);
      expect(devHasHandler).toBe(prodHasHandler);
    });
  });
});