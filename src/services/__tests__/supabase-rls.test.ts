import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import nock from 'nock';

// Load environment variables from .env file first
dotenv.config();

// Define constants for testing
const MOCK_SUPABASE_URL = 'https://egfoolala.supabase.co';
const MOCK_ANON_KEY = 'mock-anon-key';
const MOCK_SERVICE_KEY = 'mock-service-key';

// Use real environment variables if available, otherwise use mocks
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || MOCK_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || MOCK_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || MOCK_SERVICE_KEY;

// Flag to determine if we should use mocks or real API
const USE_MOCKS = !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.VITE_SUPABASE_SERVICE_KEY;

describe('Supabase RLS Policies', () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  const testRepo = 'test-owner/test-repo';
  const testData = { id: 999, title: 'Test Activity Data' };
  let testUserEmail: string;
  let testUserPassword: string;

  beforeEach(() => {
    if (USE_MOCKS) {
      // Reset all mocks between tests
      nock.cleanAll();
      
      // Mock the service role endpoint for writing data
      nock(SUPABASE_URL)
        .post('/rest/v1/github_activities?select=*')
        .matchHeader('apikey', MOCK_SERVICE_KEY)
        .matchHeader('authorization', `Bearer ${MOCK_SERVICE_KEY}`)
        .reply(200, [{ 
          repo: `test-owner/test-repo-write-test`, 
          activity_data: testData 
        }]);

      // Mock delete endpoint for service role
      nock(SUPABASE_URL)
        .delete(/\/rest\/v1\/github_activities.*/)
        .reply(200, []);

      // Mock select endpoint for anonymous access
      nock(SUPABASE_URL)
        .get(/\/rest\/v1\/github_activities\?select=\*&repo=eq\.test-owner%2Ftest-repo/)
        .matchHeader('apikey', MOCK_ANON_KEY)
        .reply(200, [{ 
          repo: testRepo, 
          activity_data: testData 
        }]);
        
      // Mock select endpoint for authenticated access  
      nock(SUPABASE_URL)
        .get(/\/rest\/v1\/github_activities\?select=\*&repo=eq\.test-owner%2Ftest-repo/)
        .matchHeader('authorization', /Bearer .+/)
        .reply(200, [{ 
          repo: testRepo, 
          activity_data: testData 
        }]);

      // Mock authenticated user write attempt - should fail with permission error
      nock(SUPABASE_URL)
        .post('/rest/v1/github_activities')
        .matchHeader('authorization', /Bearer .+/)
        .matchHeader('apikey', MOCK_ANON_KEY)
        .matchHeader('prefer', 'return=minimal')
        .reply(400, {
          message: "Permission denied for table 'github_activities'",
          code: "42501",
          details: null,
          hint: null
        });
    }
  });

  afterEach(() => {
    if (USE_MOCKS) {
      nock.cleanAll();
    }
  });

  // Setup test clients
  beforeAll(async () => {
    // Use environment variables for test user credentials
    testUserEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    testUserPassword = process.env.TEST_USER_PASSWORD || 'password123';

    if (USE_MOCKS) {
      // Mock auth endpoints
      nock(SUPABASE_URL)
        .post('/auth/v1/token')
        .reply(200, {
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'mock-user-id',
            email: testUserEmail
          }
        });

      // Setup for sign out
      nock(SUPABASE_URL)
        .post('/auth/v1/logout')
        .reply(200, {});
    }

    // Initialize clients
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    authenticatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    if (!USE_MOCKS) {
      // Clean up any previous test data using the service client first (only for real API)
      await serviceClient
        .from('github_activities')
        .delete()
        .eq('repo', testRepo);

      // Insert test data with service client to verify policies (only for real API)
      const { error: insertError } = await serviceClient
        .from('github_activities')
        .insert({
          repo: testRepo,
          activity_data: testData
        });

      if (insertError) {
        console.error('Failed to insert test data:', insertError);
        throw new Error(`Failed to set up test data: ${insertError.message}`);
      }
    }
    
    try {
      // Sign in only happens if we're using real API or if we're in the mock path
      const { error: signInError } = await authenticatedClient.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword,
      });
      
      if (signInError && !USE_MOCKS) {
        console.error('Sign-in error:', signInError);
        throw new Error(`Failed to sign in: ${signInError.message}`);
      }
    } catch (error) {
      if (!USE_MOCKS) {
        console.error('Error during setup:', error);
        throw error;
      }
    }
  });

  afterAll(async () => {
    if (USE_MOCKS) {
      nock.cleanAll();
    } else {
      // Clean up test data (only for real API)
      await serviceClient
        .from('github_activities')
        .delete()
        .eq('repo', testRepo);
        
      // Sign out authenticated client
      await authenticatedClient.auth.signOut();
    }
  });

  it('should allow service role to write data', async () => {
    // First delete existing test data to avoid conflicts
    await serviceClient
      .from('github_activities')
      .delete()
      .eq('repo', `${testRepo}-write-test`);
      
    // Then insert new test data
    const { data, error } = await serviceClient
      .from('github_activities')
      .insert({
        repo: `${testRepo}-write-test`,
        activity_data: testData
      })
      .select();

    if (error) {
      console.error('Service role write test error:', error);
    }

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (data) {
      expect(data[0]?.repo).toBe(`${testRepo}-write-test`);
    }
  });

  it('should allow anonymous users to read data (public read policy)', async () => {
    const { data, error } = await anonClient
      .from('github_activities')
      .select()
      .eq('repo', testRepo);

    if (error) {
      console.error('Anonymous read test error:', error);
    }

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      expect(data[0]?.repo).toBe(testRepo);
    }
  });

  it('should allow authenticated users to read data', async () => {
    const { data, error } = await authenticatedClient
      .from('github_activities')
      .select()
      .eq('repo', testRepo);

    if (error) {
      console.error('Authenticated read test error:', error);
    }

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      expect(data[0]?.repo).toBe(testRepo);
    }
  });

  it('should NOT allow authenticated users to write data', async () => {
    const { error } = await authenticatedClient
      .from('github_activities')
      .insert({
        repo: 'another-test/repo',
        activity_data: { test: 'data' }
      });

    // Should return a permission error
    expect(error).not.toBeNull();
  });
});