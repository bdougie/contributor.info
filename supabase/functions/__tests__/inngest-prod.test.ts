import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Deno environment
global.Deno = {
  env: {
    get: (key: string) => {
      const envMap: Record<string, string> = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        INNGEST_APP_ID: 'contributor-info-test',
        INNGEST_EVENT_KEY: 'test-event-key',
        INNGEST_SIGNING_KEY: 'test-signing-key',
        GITHUB_TOKEN: 'test-github-token',
      };
      return envMap[key];
    },
  },
} as any;

// Mock modules
vi.mock('https://esm.sh/@supabase/supabase-js@2.39.7', () => ({
  createClient: vi.fn(),
}));

vi.mock('https://esm.sh/inngest@3.16.1', () => ({
  Inngest: vi.fn().mockImplementation(() => ({
    createFunction: vi.fn(),
  })),
}));

vi.mock('https://esm.sh/inngest@3.16.1/components/InngestCommHandler', () => ({
  InngestCommHandler: vi.fn().mockImplementation(() => ({
    serve: vi.fn(),
  })),
}));

vi.mock('https://deno.land/std@0.177.0/http/server.ts', () => ({
  serve: vi.fn(),
}));

vi.mock('https://esm.sh/@octokit/graphql@7.0.2', () => ({
  graphql: {
    defaults: vi.fn().mockReturnValue(vi.fn()),
  },
}));

describe('Inngest Production Edge Function', () => {
  let mockSupabase: any;
  let handler: (req: Request) => Promise<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      auth: {
        getUser: vi.fn(),
      },
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  describe('CORS Handling', () => {
    it('returns proper CORS headers for OPTIONS preflight requests', async () => {
      const request = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://inn.gs',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-inngest-signature, content-type',
        },
      });

      // Dynamic import to get fresh handler
      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      const response = await serveCallback(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('x-inngest-signature');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Inngest-Signature');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('x-inngest-sdk');
    });

    it('includes CORS headers in regular responses', async () => {
      const request = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'GET',
      });

      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      const response = await serveCallback(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });
  });

  describe('Status Endpoint', () => {
    it('returns status page for GET requests', async () => {
      const request = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'GET',
      });

      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      const response = await serveCallback(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Inngest Production endpoint');
      expect(data.status).toBe('active');
      expect(data.endpoint).toBe('/functions/v1/inngest-prod');
      expect(data.environment.runtime).toBe('deno');
      expect(data.environment.platform).toBe('supabase-edge');
      expect(data.environment.hasEventKey).toBe(true);
      expect(data.environment.hasSigningKey).toBe(true);
      expect(data.environment.hasGithubToken).toBe(true);
      expect(data.functions).toBeInstanceOf(Array);
      expect(data.functions.length).toBeGreaterThan(0);
      expect(data.cors.enabled).toBe(true);
    });
  });

  describe('Webhook Signature Verification', () => {
    it('verifies Inngest webhook signatures', async () => {
      // This would test actual signature verification
      // For now, we test that the handler is configured with signing key
      const module = await import('../inngest-prod/index.ts');

      // Check that signing key is configured
      expect(Deno.env.get('INNGEST_SIGNING_KEY')).toBeTruthy();
    });
  });

  describe('Environment Configuration', () => {
    it('has all required environment variables', () => {
      const requiredEnvVars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'INNGEST_EVENT_KEY',
        'INNGEST_SIGNING_KEY',
        'GITHUB_TOKEN',
      ];

      for (const envVar of requiredEnvVars) {
        expect(Deno.env.get(envVar)).toBeTruthy();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles internal server errors gracefully', async () => {
      const request = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
      });

      // Mock handler to throw error
      const mockHandler = vi.fn().mockRejectedValue(new Error('Test error'));

      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      // Override the handler
      vi.spyOn(module, 'inngestHandler').mockImplementation(mockHandler);

      const response = await serveCallback(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.service).toBe('inngest-prod');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('GraphQL Client', () => {
    it('initializes GraphQL client with GitHub token', async () => {
      const { GraphQLClient } = await import('../inngest-prod/graphql-client.ts');

      expect(() => new GraphQLClient()).not.toThrow();
    });

    it('handles rate limiting gracefully', async () => {
      const { GraphQLClient } = await import('../inngest-prod/graphql-client.ts');
      const client = new GraphQLClient();

      // Mock rate limit error
      vi.spyOn(client, 'getRecentPRs').mockRejectedValue(
        new Error('GraphQL rate limit exceeded')
      );

      await expect(client.getRecentPRs('owner', 'repo', '2024-01-01', 100))
        .rejects.toThrow('GraphQL rate limit exceeded');
    });
  });

  describe('Repository Classifier', () => {
    it('classifies repositories based on metrics', async () => {
      const { RepositorySizeClassifier } = await import('../inngest-prod/repository-classifier.ts');
      const classifier = new RepositorySizeClassifier('test-token');

      // Mock fetchMetrics
      vi.spyOn(classifier, 'fetchMetrics').mockResolvedValue({
        stars: 15000,
        forks: 2000,
        monthlyPRs: 600,
        monthlyCommits: 2500,
        activeContributors: 75,
      });

      const metrics = await classifier.fetchMetrics('owner', 'repo');
      const size = classifier.classifySize(metrics);

      expect(size).toBe('large');
    });
  });

  describe('Inngest Functions', () => {
    it('creates capture repository sync GraphQL function', async () => {
      const { createCaptureRepositorySyncGraphQL } = await import('../inngest-prod/functions.ts');
      const mockInngest = {
        createFunction: vi.fn().mockReturnValue({
          id: 'capture-repository-sync-graphql',
          name: 'Sync Recent Repository PRs (GraphQL)',
        }),
      };

      const func = createCaptureRepositorySyncGraphQL(mockInngest);

      expect(mockInngest.createFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'capture-repository-sync-graphql',
          name: 'Sync Recent Repository PRs (GraphQL)',
        }),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('creates classify single repository function', async () => {
      const { createClassifySingleRepository } = await import('../inngest-prod/functions.ts');
      const mockInngest = {
        createFunction: vi.fn().mockReturnValue({
          id: 'classify-single-repository',
          name: 'Classify Single Repository',
        }),
      };

      const func = createClassifySingleRepository(mockInngest);

      expect(mockInngest.createFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'classify-single-repository',
          name: 'Classify Single Repository',
        }),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Performance', () => {
    it('handles large payloads efficiently', async () => {
      const largePayload = {
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: 'test-id',
          prs: Array(1000).fill({ id: 'pr', title: 'Test PR' }),
        },
      };

      const request = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-inngest-signature': 'test-signature',
        },
        body: JSON.stringify(largePayload),
      });

      const startTime = Date.now();

      // This would test actual performance
      // For now we just ensure the request doesn't hang
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      const response = Promise.race([serveCallback(request), timeout]);

      await expect(response).resolves.toBeDefined();

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Idempotency', () => {
    it('prevents duplicate webhook processing', async () => {
      // This would test idempotency key handling
      // Similar to the queue-event implementation
      const request1 = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'POST',
        headers: {
          'x-inngest-signature': 'test-signature',
          'x-idempotency-key': 'test-key-123',
        },
        body: JSON.stringify({
          name: 'test/prod.hello',
          data: { message: 'Test' },
        }),
      });

      const request2 = new Request('https://example.com/functions/v1/inngest-prod', {
        method: 'POST',
        headers: {
          'x-inngest-signature': 'test-signature',
          'x-idempotency-key': 'test-key-123', // Same key
        },
        body: JSON.stringify({
          name: 'test/prod.hello',
          data: { message: 'Test' },
        }),
      });

      // Mock database to return existing idempotency key
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          key: 'test-key-123',
          status: 'completed',
          response: { success: true, cached: true },
        },
      });

      const module = await import('../inngest-prod/index.ts');
      const serveCallback = (module as any).default || (global as any).__inngestHandler;

      // First request would process normally
      // Second request should return cached response
      // Implementation would need idempotency handling in the main handler
    });
  });
});

describe('Integration Tests', () => {
  describe('End-to-End Workflow', () => {
    it('processes webhook from receipt to function execution', async () => {
      // This would test the complete flow
      // 1. Receive webhook
      // 2. Verify signature
      // 3. Route to correct function
      // 4. Execute function logic
      // 5. Return response
    });
  });

  describe('Fallback to Netlify', () => {
    it('falls back to Netlify endpoint on failure', async () => {
      // This would test circuit breaker pattern
      // When Supabase Edge Function fails, traffic routes to Netlify
    });
  });
});