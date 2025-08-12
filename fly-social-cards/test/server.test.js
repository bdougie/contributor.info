import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the card generator module
const mockGenerateSocialCard = vi.fn((data) => {
  return `<svg>${data.title}</svg>`;
});

vi.mock('../src/card-generator.js', () => ({
  generateSocialCard: mockGenerateSocialCard
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null)
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

  describe('Input Validation', () => {
    it('should reject invalid owner parameter', async () => {
      const res = await request(app)
        .get('/social-cards/repo')
        .query({ owner: 'invalid<script>', repo: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid input parameters');
    });

    it('should reject very long input parameters', async () => {
      const longString = 'a'.repeat(101);
      const res = await request(app)
        .get('/social-cards/repo')
        .query({ owner: longString, repo: 'test' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid input parameters');
    });

    it('should accept valid parameters', async () => {
      const res = await request(app)
        .get('/social-cards/repo')
        .query({ owner: 'valid-owner_123', repo: 'valid.repo-name' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
    });

    it('should accept valid title with spaces', async () => {
      const res = await request(app)
        .get('/social-cards/home')
        .query({ title: 'Valid Title Here', subtitle: 'Valid Subtitle' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
    });
  });

  describe('Social Card Generation', () => {
    it('should generate home card with default values', async () => {
      const res = await request(app).get('/social-cards/home');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
      expect(res.headers['cache-control']).toContain('public');
      expect(mockGenerateSocialCard).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'contributor.info',
          type: 'home'
        })
      );
    });

    it('should generate repo card with fallback data', async () => {
      const res = await request(app)
        .get('/social-cards/repo')
        .query({ owner: 'test', repo: 'repo' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
      expect(mockGenerateSocialCard).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'test/repo',
          type: 'repo',
          stats: expect.objectContaining({
            weeklyPRVolume: expect.any(Number),
            activeContributors: expect.any(Number)
          })
        })
      );
    });

    it('should generate user card with fallback data', async () => {
      const res = await request(app)
        .get('/social-cards/user')
        .query({ username: 'testuser' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
      expect(mockGenerateSocialCard).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '@testuser',
          type: 'user'
        })
      );
    });
  });

  describe('Legacy Endpoint', () => {
    it('should redirect legacy endpoint to new structure', async () => {
      const res = await request(app)
        .get('/api/social-cards')
        .query({ owner: 'test', repo: 'repo' });
      expect(res.status).toBe(301);
      expect(res.headers.location).toContain('/social-cards/repo');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits after max requests', async () => {
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 61; i++) {
        promises.push(
          request(app).get('/social-cards/home')
        );
      }
      
      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.body).toHaveProperty('error', 'Too many requests');
      expect(limitedResponse.body).toHaveProperty('retryAfter');
    });
  });

  describe('Error Handling', () => {
    it('should return error card on generation failure', async () => {
      // Mock a failure
      mockGenerateSocialCard.mockImplementationOnce(() => {
        throw new Error('Generation failed');
      });
      
      const res = await request(app).get('/social-cards/home');
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toBe('image/svg+xml');
      expect(res.headers['cache-control']).toBe('no-cache');
    });
  });
});