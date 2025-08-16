import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';

// Mock webhook payloads
const mockPullRequestPayload = {
  action: 'opened',
  pull_request: {
    id: 123456,
    number: 42,
    title: 'Test PR',
    body: 'This is a test pull request',
    state: 'open',
    user: {
      id: 789,
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
      type: 'User'
    },
    base: { ref: 'main' },
    head: { ref: 'feature-branch' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: 'https://github.com/test/repo/pull/42'
  },
  repository: {
    id: 111,
    name: 'repo',
    full_name: 'test/repo',
    owner: {
      login: 'test',
      type: 'Organization'
    },
    private: false,
    html_url: 'https://github.com/test/repo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  installation: {
    id: 999
  }
};

const mockIssuePayload = {
  action: 'opened',
  issue: {
    id: 654321,
    number: 100,
    title: 'Test Issue',
    body: 'This is a test issue',
    state: 'open',
    user: {
      id: 456,
      login: 'issueuser',
      avatar_url: 'https://github.com/issueuser.png',
      type: 'User'
    },
    labels: [
      { name: 'bug', color: 'ff0000' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: 'https://github.com/test/repo/issues/100'
  },
  repository: mockPullRequestPayload.repository,
  installation: mockPullRequestPayload.installation
};

describe.skip('GitHub Webhook Handler - Server Integration Tests (requires running server)', () => {
  let serverUrl;
  
  beforeAll(() => {
    // NOTE: These integration tests require a running server.
    // They are skipped by default to prevent CI failures.
    // To run these tests locally:
    // 1. Start the server: npm start
    // 2. Run tests with: TEST_SERVER_URL=http://localhost:8080 npm test
    serverUrl = process.env.TEST_SERVER_URL || 'http://localhost:8080';
  });
  
  afterAll(() => {
    // Clean up server if needed
  });
  
  describe('Health Checks', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${serverUrl}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });
    
    it('should return metrics', async () => {
      const response = await fetch(`${serverUrl}/metrics`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.webhooks).toBeDefined();
      expect(data.performance).toBeDefined();
      expect(data.uptime).toBeDefined();
    });
  });
  
  describe('Webhook Signature Verification', () => {
    it('should reject webhook without signature', async () => {
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
          'x-github-delivery': 'test-delivery-1'
        },
        body: JSON.stringify({ zen: 'test' })
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject webhook with invalid signature', async () => {
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
          'x-github-delivery': 'test-delivery-2',
          'x-hub-signature-256': 'sha256=invalid'
        },
        body: JSON.stringify({ zen: 'test' })
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should accept webhook with valid signature', async () => {
      const secret = process.env.GITHUB_APP_WEBHOOK_SECRET || 'test-secret';
      const payload = JSON.stringify({ zen: 'test' });
      const signature = createSignature(payload, secret);
      
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
          'x-github-delivery': 'test-delivery-3',
          'x-hub-signature-256': signature
        },
        body: payload
      });
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Webhook Event Processing', () => {
    it('should process ping event', async () => {
      const payload = JSON.stringify({ zen: 'Design for failure.' });
      const signature = createSignature(payload, process.env.GITHUB_APP_WEBHOOK_SECRET || 'test-secret');
      
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
          'x-github-delivery': 'test-ping',
          'x-hub-signature-256': signature
        },
        body: payload
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Webhook received');
      expect(data.event).toBe('ping');
    });
    
    it('should process pull_request opened event', async () => {
      const payload = JSON.stringify(mockPullRequestPayload);
      const signature = createSignature(payload, process.env.GITHUB_APP_WEBHOOK_SECRET || 'test-secret');
      
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-pr-opened',
          'x-hub-signature-256': signature
        },
        body: payload
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event).toBe('pull_request');
    });
    
    it('should process issues opened event', async () => {
      const payload = JSON.stringify(mockIssuePayload);
      const signature = createSignature(payload, process.env.GITHUB_APP_WEBHOOK_SECRET || 'test-secret');
      
      const response = await fetch(`${serverUrl}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'issues',
          'x-github-delivery': 'test-issue-opened',
          'x-hub-signature-256': signature
        },
        body: payload
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event).toBe('issues');
    });
  });
});

// Helper function to create webhook signature
function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return `sha256=${digest}`;
}