import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

// Import server after mocks are set up
let app;
let server;

describe('Social Cards Server', () => {
  beforeAll(async () => {
    // Set test environment variables
    process.env.PORT = '3001';

    // Import and start server
    const serverModule = await import('../src/server.js');
    app = serverModule.app;
  });

  afterAll(() => {
    if (server) server.close();
  });

  describe('Health Check', () => {
    it('should return 200 for health check', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requests_total');
      expect(res.body).toHaveProperty('avg_response_time_ms');
    });
  });

  // Card rendering moved to a Netlify Function on contributor.info; this
  // service permanently redirects so og:image URLs cached by social
  // platforms from old shares keep resolving.
  describe('Social Card Redirects', () => {
    it('redirects repo cards to contributor.info with params intact', async () => {
      const res = await request(app)
        .get('/social-cards/repo')
        .query({ owner: 'test', repo: 'repo' });
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(
        'https://contributor.info/social-cards/repo?owner=test&repo=repo'
      );
    });

    it('redirects the bare endpoint to the home card', async () => {
      const res = await request(app).get('/social-cards');
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('https://contributor.info/social-cards/home');
    });

    it('redirects user cards', async () => {
      const res = await request(app).get('/social-cards/user').query({ username: 'testuser' });
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(
        'https://contributor.info/social-cards/user?username=testuser'
      );
    });

    it('redirects the legacy endpoint with inferred card type', async () => {
      const res = await request(app)
        .get('/api/social-cards')
        .query({ owner: 'test', repo: 'repo' });
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(
        'https://contributor.info/social-cards/repo?owner=test&repo=repo'
      );
    });

    it('escapes unexpected card types in the redirect path', async () => {
      const res = await request(app).get('/social-cards/we%20ird');
      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('https://contributor.info/social-cards/we%20ird');
    });
  });

  describe('Chart Input Validation', () => {
    it('should reject invalid chart type', async () => {
      const res = await request(app).get('/charts/not-a-chart');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid chart type');
    });

    it('should reject missing owner/repo', async () => {
      const res = await request(app).get('/charts/lottery-factor');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Missing required parameters: owner, repo');
    });

    it('should reject invalid owner parameter', async () => {
      const res = await request(app)
        .get('/charts/lottery-factor')
        .query({ owner: 'invalid<script>', repo: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid input parameters');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits after max requests on chart routes', async () => {
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 61; i++) {
        promises.push(request(app).get('/charts/not-a-chart'));
      }

      const results = await Promise.all(promises);
      const rateLimited = results.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      const limitedResponse = rateLimited[0];
      expect(limitedResponse.body).toHaveProperty('error', 'Too many requests');
      expect(limitedResponse.body).toHaveProperty('retryAfter');
    });
  });
});
