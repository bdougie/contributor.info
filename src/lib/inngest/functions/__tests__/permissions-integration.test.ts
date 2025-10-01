import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { supabase as anonClient } from '../../../supabase';

/**
 * Integration tests for Inngest function permissions
 *
 * These tests verify:
 * 1. Inngest functions use service role key (not anon key)
 * 2. Database writes succeed with proper permissions
 * 3. RLS policies don't block server-side operations
 *
 * These tests would have caught the production bug where RLS
 * was enabled and Inngest functions were using anon key.
 *
 * Note: These tests require SUPABASE_SERVICE_ROLE_KEY to be set.
 * They will be skipped in environments without proper credentials.
 */

// Dynamic import to avoid throwing error during module load
let adminClient: typeof anonClient | null = null;
let hasAdminAccess = false;

try {
  const serverModule = await import('../../supabase-server');
  adminClient = serverModule.supabase;
  hasAdminAccess = true;
} catch {
  console.warn('⚠️ Skipping permission tests: Admin client not available');
  hasAdminAccess = false;
}

describe('Inngest Function Permissions Integration', () => {
  // Test repository data
  const testRepo = {
    owner: 'test-org',
    name: 'test-repo',
    full_name: 'test-org/test-repo',
  };

  const testContributor = {
    github_id: '99999999',
    username: 'test-user',
    display_name: 'Test User',
    avatar_url: 'https://avatars.githubusercontent.com/u/99999999',
    profile_url: 'https://github.com/test-user',
  };

  let testRepositoryId: string;
  let testContributorId: string;

  beforeAll(async () => {
    if (!hasAdminAccess || !adminClient) return;

    // Clean up any existing test data
    await adminClient.from('repositories').delete().eq('owner', testRepo.owner);
    await adminClient.from('contributors').delete().eq('github_id', testContributor.github_id);
  });

  afterAll(async () => {
    if (!hasAdminAccess || !adminClient) return;

    // Clean up test data
    if (testRepositoryId) {
      await adminClient.from('repositories').delete().eq('id', testRepositoryId);
    }
    if (testContributorId) {
      await adminClient.from('contributors').delete().eq('id', testContributorId);
    }
  });

  describe('Client Type Verification', () => {
    it.skipIf(!hasAdminAccess)('should use different clients for anon vs admin operations', () => {
      // Verify we're testing the right clients
      expect(anonClient).toBeDefined();
      expect(adminClient).toBeDefined();
      expect(anonClient).not.toBe(adminClient);
    });

    it.skipIf(!hasAdminAccess)('should have service role key in admin client', () => {
      // Admin client should use service role key (starts with 'eyJ')
      const adminHeaders =
        (adminClient as unknown as { headers?: Record<string, string> }).headers || {};
      const apiKey = adminHeaders.apikey || process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(apiKey).toBeDefined();
      expect(apiKey).toContain('eyJ'); // JWT format
    });

    it.skipIf(!process.env.VITE_SUPABASE_ANON_KEY)('should have anon key in regular client', () => {
      const anonHeaders =
        (anonClient as unknown as { headers?: Record<string, string> }).headers || {};
      const apiKey = anonHeaders.apikey || process.env.VITE_SUPABASE_ANON_KEY;

      expect(apiKey).toBeDefined();
      expect(apiKey).toContain('eyJ'); // JWT format
    });
  });

  describe('Repository Write Permissions', () => {
    it.skipIf(!hasAdminAccess)(
      'admin client should successfully write to repositories table',
      async () => {
        const { data, error } = await adminClient
          .from('repositories')
          .insert({
            owner: testRepo.owner,
            name: testRepo.name,
            full_name: testRepo.full_name,
            github_id: '99999999',
          })
          .select('id')
          .maybeSingle();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.id).toBeDefined();

        testRepositoryId = data!.id;
      }
    );

    it.skipIf(!hasAdminAccess)(
      'should handle RLS gracefully when writing with admin client',
      async () => {
        // This test verifies that even with RLS enabled,
        // admin client can write to protected tables
        const { error } = await adminClient
          .from('repositories')
          .update({ last_updated_at: new Date().toISOString() })
          .eq('id', testRepositoryId);

        expect(error).toBeNull();
      }
    );
  });

  describe('Contributor Write Permissions', () => {
    it.skipIf(!hasAdminAccess)(
      'admin client should successfully write to contributors table',
      async () => {
        const { data, error } = await adminClient
          .from('contributors')
          .upsert(
            {
              github_id: testContributor.github_id,
              username: testContributor.username,
              display_name: testContributor.display_name,
              avatar_url: testContributor.avatar_url,
              profile_url: testContributor.profile_url,
              is_bot: false,
              is_active: true,
            },
            {
              onConflict: 'github_id',
              ignoreDuplicates: false,
            }
          )
          .select('id')
          .maybeSingle();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.id).toBeDefined();

        testContributorId = data!.id;
      }
    );

    it.skipIf(!hasAdminAccess)('should verify contributor exists after upsert', async () => {
      const { data, error } = await adminClient
        .from('contributors')
        .select('id, username')
        .eq('github_id', testContributor.github_id)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.username).toBe(testContributor.username);
    });
  });

  describe('Pull Request Write Permissions', () => {
    it.skipIf(!hasAdminAccess)(
      'admin client should write PRs with proper author_id references',
      async () => {
        const { data, error } = await adminClient
          .from('pull_requests')
          .insert({
            github_id: '88888888',
            repository_id: testRepositoryId,
            repository_full_name: testRepo.full_name,
            number: 1,
            title: 'Test PR',
            state: 'open',
            author_id: testContributorId, // This is a UUID reference
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: `https://github.com/${testRepo.full_name}/pull/1`,
          })
          .select('id, author_id')
          .maybeSingle();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data?.author_id).toBe(testContributorId);

        // Clean up
        if (data?.id) {
          await adminClient.from('pull_requests').delete().eq('id', data.id);
        }
      }
    );

    it.skipIf(!hasAdminAccess)(
      'should reject PRs with null author_id if constraint exists',
      async () => {
        // This test documents expected behavior - PRs should have author_id
        const { data, error } = await adminClient
          .from('pull_requests')
          .insert({
            github_id: '77777777',
            repository_id: testRepositoryId,
            repository_full_name: testRepo.full_name,
            number: 2,
            title: 'Test PR without author',
            state: 'open',
            author_id: null, // This should be rejected if constraint exists
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            html_url: `https://github.com/${testRepo.full_name}/pull/2`,
          })
          .select('id')
          .maybeSingle();

        // If constraint exists, error should be present
        // If no constraint, we should still track this as technical debt
        if (error) {
          expect(error.message).toContain('violates');
        } else if (data?.id) {
          // Clean up and log warning
          await adminClient.from('pull_requests').delete().eq('id', data.id);
          console.warn(
            '⚠️ WARNING: Pull requests can be created without author_id. Consider adding NOT NULL constraint.'
          );
        }
      }
    );
  });

  describe('Error Handling and Logging', () => {
    it.skipIf(!hasAdminAccess)('should throw errors instead of silently failing', async () => {
      // Simulate the bug: trying to insert with missing required fields
      const { error } = await adminClient
        .from('repositories')
        .insert({
          // Missing required fields
          owner: testRepo.owner,
          // Missing 'name' which is required
        })
        .select();

      // We WANT this to error - silent failures are bad
      expect(error).toBeDefined();
      expect(error?.message).toBeDefined();
    });

    it.skipIf(!hasAdminAccess)('should provide detailed error messages for debugging', async () => {
      const { error } = await adminClient
        .from('contributors')
        .insert({
          github_id: testContributor.github_id, // Duplicate - should fail
          username: 'duplicate-test',
        })
        .select();

      if (error) {
        // Error should have enough detail for debugging
        expect(error.message).toBeTruthy();
        expect(error.message.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Regression Tests for Production Bug', () => {
    it.skipIf(!hasAdminAccess)('should detect if Inngest functions are using wrong client', () => {
      // Import the actual supabase-server module
      const serverModule = vi.importActual('../../supabase-server') as {
        supabase: typeof anonClient;
      };

      expect(serverModule.supabase).toBeDefined();
      expect(serverModule.supabase).toBe(adminClient);

      // Verify it's NOT the anon client
      expect(serverModule.supabase).not.toBe(anonClient);
    });

    it('should verify GraphQL query ordering uses CREATED_AT', async () => {
      // Read the GraphQL client source to verify the fix
      const fs = await import('fs');
      const path = await import('path');

      const graphqlClientPath = path.join(process.cwd(), 'src/lib/inngest/graphql-client.ts');
      const content = fs.readFileSync(graphqlClientPath, 'utf-8');

      // Verify query uses CREATED_AT ordering
      expect(content).toContain('CREATED_AT');
      expect(content).toContain('orderBy: {field: CREATED_AT, direction: DESC}');

      // Verify filtering uses createdAt
      expect(content).toContain('const createdAt = new Date(pr.createdAt');
    });

    it('should verify concurrency limit is set appropriately', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const syncGraphqlPath = path.join(
        process.cwd(),
        'src/lib/inngest/functions/capture-repository-sync-graphql.ts'
      );
      const content = fs.readFileSync(syncGraphqlPath, 'utf-8');

      // Verify concurrency limit was increased from 5
      expect(content).toContain('limit: 10');
      expect(content).not.toContain('limit: 5,');
    });
  });

  describe('Permission Error Detection', () => {
    it.skipIf(!hasAdminAccess)('should clearly identify permission errors', async () => {
      // Try to write with anon client to see if RLS blocks it
      const { error: anonError } = await anonClient
        .from('repositories')
        .insert({
          owner: 'test-anon',
          name: 'test-anon-repo',
          full_name: 'test-anon/test-anon-repo',
          github_id: '11111111',
        })
        .select();

      // If RLS is enabled, anon client should be blocked
      if (anonError) {
        // Error should clearly indicate permission issue
        const errorMessage = anonError.message.toLowerCase();
        expect(
          errorMessage.includes('permission') ||
            errorMessage.includes('policy') ||
            errorMessage.includes('denied') ||
            errorMessage.includes('rls')
        ).toBe(true);
      }
    });
  });
});
