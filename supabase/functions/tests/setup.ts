/**
 * Test setup and utilities for edge functions
 * 
 * Provides mock clients, test data, and helper functions for testing.
 */

import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.177.0/testing/asserts.ts';

// Mock Supabase client for testing
export class MockSupabaseClient {
  private data: Map<string, Record<string, unknown>[]> = new Map();

  from(table: string) {
    return {
      select: (_columns: string) => ({
        eq: (column: string, value: unknown) => ({
          single: () => {
            const records = this.data.get(table) || [];
            const found = records.find(r => r[column] === value);
            return { data: found, error: found ? null : { message: 'Not found' } };
          },
          maybeSingle: () => {
            const records = this.data.get(table) || [];
            const found = records.find(r => r[column] === value);
            return { data: found || null, error: null };
          },
        }),
      }),
      insert: (record: Record<string, unknown>) => {
        const records = this.data.get(table) || [];
        const newRecord = { ...record, id: `mock-id-${records.length}` };
        records.push(newRecord);
        this.data.set(table, records);
        return { data: newRecord, error: null };
      },
      upsert: (record: Record<string, unknown>, options: { onConflict: string }) => {
        const records = this.data.get(table) || [];
        const existingIndex = records.findIndex(r => 
          r[options.onConflict] === record[options.onConflict]
        );
        
        if (existingIndex >= 0) {
          records[existingIndex] = { ...records[existingIndex], ...record };
          this.data.set(table, records);
          return {
            data: records[existingIndex],
            error: null,
            select: () => ({
              single: () => ({ data: records[existingIndex], error: null }),
              maybeSingle: () => ({ data: records[existingIndex], error: null }),
            }),
          };
        } else {
          const newRecord = { ...record, id: `mock-id-${records.length}` };
          records.push(newRecord);
          this.data.set(table, records);
          return {
            data: newRecord,
            error: null,
            select: () => ({
              single: () => ({ data: newRecord, error: null }),
              maybeSingle: () => ({ data: newRecord, error: null }),
            }),
          };
        }
      },
    };
  }

  // Helper to seed test data
  seed(table: string, records: Record<string, unknown>[]) {
    this.data.set(table, records);
  }

  // Helper to get all data for verification
  getData(table: string) {
    return this.data.get(table) || [];
  }

  // Helper to reset all data
  reset() {
    this.data.clear();
  }
}

// Mock GitHub API client
export class MockGitHubClient {
  private users: Map<string, Record<string, unknown>> = new Map();
  private repos: Map<string, Record<string, unknown>> = new Map();

  constructor() {
    // Seed with test data
    this.users.set('testuser', {
      login: 'testuser',
      name: 'Test User',
      bio: 'Test bio',
      public_repos: 10,
      followers: 50,
      following: 30,
      created_at: '2020-01-01T00:00:00Z',
    });
  }

  getUser(username: string) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found: ' + username);
    }
    return user;
  }

  getRepository(owner: string, repo: string) {
    const key = owner + '/' + repo;
    const repository = this.repos.get(key);
    if (!repository) {
      throw new Error('Repository not found: ' + key);
    }
    return repository;
  }

  // Helper to seed test users
  seedUser(username: string, data: Record<string, unknown>) {
    this.users.set(username, data);
  }

  // Helper to seed test repositories
  seedRepo(owner: string, repo: string, data: Record<string, unknown>) {
    this.repos.set(owner + '/' + repo, data);
  }
}

// Test data generators
export const generateTestUser = (overrides = {}) => ({
  id: 12345,
  login: 'testuser',
  name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  bio: 'Test user bio',
  company: 'Test Company',
  location: 'Test City',
  email: 'test@example.com',
  blog: 'https://example.com',
  twitter_username: 'testuser',
  public_repos: 10,
  followers: 50,
  following: 30,
  created_at: '2020-01-01T00:00:00Z',
  type: 'User',
  ...overrides,
});

export const generateSpamUser = (overrides = {}) => ({
  id: 99999,
  login: 'spamuser123456',
  name: null,
  avatar_url: 'https://avatars.githubusercontent.com/u/99999',
  bio: 'Buy crypto! Airdrop giveaway!',
  company: null,
  location: null,
  email: null,
  blog: 'https://spam.tk',
  twitter_username: null,
  public_repos: 100,
  followers: 5,
  following: 5000,
  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
  type: 'User',
  ...overrides,
});

// HTTP request helpers
export const createTestRequest = (body: unknown, options: RequestInit = {}) => {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
};

// Response assertion helpers
export const assertSuccessResponse = async (response: Response) => {
  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  
  const data = await response.json();
  assertEquals(data.success, true);
  assertExists(data.data);
  
  return data.data;
};

export const assertErrorResponse = async (
  response: Response,
  expectedStatus: number,
  expectedMessage?: string
) => {
  assertEquals(response.status, expectedStatus);
  
  const data = await response.json();
  assertEquals(data.success, false);
  assertExists(data.error);
  
  if (expectedMessage) {
    assert(data.error.includes(expectedMessage));
  }
  
  return data.error;
};