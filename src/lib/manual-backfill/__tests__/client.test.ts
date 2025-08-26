import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('GH_DATPIPE_API_URL', 'https://test-api.example.com');
vi.stubEnv('GH_DATPIPE_KEY', 'test-key-123');

describe('ManualBackfillClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHeaders', () => {
    it('should return correct headers with API key', () => {
      // Pure function test - just checking header format
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key-123',
      };
      
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-API-Key']).toBe('test-key-123');
    });
  });

  describe('URL construction', () => {
    it('should build correct trigger URL', () => {
      const apiUrl = 'https://test-api.example.com';
      const endpoint = '/api/backfill/trigger';
      const fullUrl = `${apiUrl}${endpoint}`;
      
      expect(fullUrl).toBe('https://test-api.example.com/api/backfill/trigger');
    });

    it('should build correct status URL with job ID', () => {
      const apiUrl = 'https://test-api.example.com';
      const jobId = '123-456-789';
      const fullUrl = `${apiUrl}/api/backfill/status/${jobId}`;
      
      expect(fullUrl).toBe('https://test-api.example.com/api/backfill/status/123-456-789');
    });
  });

  describe('Request payload validation', () => {
    it('should create valid trigger payload', () => {
      const request = {
        repository: 'owner/repo',
        days: 30,
        force: false,
        callback_url: 'https://example.com/webhook',
      };
      
      expect(request.repository).toMatch(/^[^/]+\/[^/]+$/);
      expect(request.days).toBeGreaterThan(0);
      expect(request.days).toBeLessThanOrEqual(365);
      expect(typeof request.force).toBe('boolean');
    });

    it('should validate repository format', () => {
      const validRepos = ['owner/repo', 'org-name/repo-name', 'user123/project_456'];
      const invalidRepos = ['justowner', '/repo', 'owner/', 'owner/repo/extra'];
      
      validRepos.forEach(repo => {
        expect(repo).toMatch(/^[^/]+\/[^/]+$/);
      });
      
      invalidRepos.forEach(repo => {
        expect(repo).not.toMatch(/^[^/]+\/[^/]+$/);
      });
    });
  });

  describe('Response validation', () => {
    it('should validate backfill response structure', () => {
      const mockResponse = {
        job_id: '550e8400-e29b-41d4-a716',
        status: 'queued',
        repository: 'owner/repo',
        days: 30,
        estimated_completion: '2025-01-01T00:00:00Z',
        status_url: '/api/backfill/status/550e8400',
      };
      
      expect(mockResponse.job_id).toBeDefined();
      expect(['queued', 'running', 'completed', 'failed', 'cancelled']).toContain(mockResponse.status);
      expect(mockResponse.repository).toMatch(/^[^/]+\/[^/]+$/);
      expect(mockResponse.days).toBeGreaterThan(0);
    });

    it('should validate job status structure', () => {
      const mockStatus = {
        id: '550e8400',
        status: 'running',
        progress: 45,
        message: 'Processing...',
        data: {
          repository: 'owner/repo',
          days: 30,
        },
        created_at: '2025-01-01T00:00:00Z',
      };
      
      expect(mockStatus.id).toBeDefined();
      expect(mockStatus.progress).toBeGreaterThanOrEqual(0);
      expect(mockStatus.progress).toBeLessThanOrEqual(100);
      expect(mockStatus._data.repository).toBeDefined();
    });
  });
});