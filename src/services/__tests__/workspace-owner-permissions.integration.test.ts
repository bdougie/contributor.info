/**
 * Integration test for workspace owner permissions
 * Tests against local Supabase instance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use test database URL and anon key
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('Workspace Owner Permissions Integration Test', () => {
  let testUserId: string;
  let testWorkspaceId: string;
  let testRepositoryId: string;

  beforeAll(async () => {
    // Create a test user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `test-owner-${Date.now()}@test.com`,
      password: 'TestPassword123!'
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    testUserId = authData.user?.id || '';
    
    // Create a test repository entry if needed
    const { data: repo, error: repoError } = await supabase
      .from('repositories')
      .insert({
        owner: 'test-owner',
        name: 'test-repo',
        full_name: 'test-owner/test-repo'
      })
      .select()
      .single();

    if (repoError) {
      // Repository might already exist, try to fetch it
      const { data: existingRepo } = await supabase
        .from('repositories')
        .select()
        .eq('full_name', 'test-owner/test-repo')
        .single();
      
      testRepositoryId = existingRepo?.id || '';
    } else {
      testRepositoryId = repo.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWorkspaceId) {
      await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', testWorkspaceId);

      await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', testWorkspaceId);

      await supabase
        .from('workspaces')
        .delete()
        .eq('id', testWorkspaceId);
    }

    // Sign out
    await supabase.auth.signOut();
  });

  describe('Workspace Owner Member Creation', () => {
    it('should automatically add owner as a member when creating workspace', async () => {
      // Create a workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: 'Test Workspace',
          slug: `test-workspace-${Date.now()}`,
          owner_id: testUserId,
          description: 'Test workspace for owner permissions'
        })
        .select()
        .single();

      expect(workspaceError).toBeNull();
      expect(workspace).toBeDefined();
      
      testWorkspaceId = workspace!.id;

      // Check if owner was automatically added as a member
      const { data: member, error: memberError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', testWorkspaceId)
        .eq('user_id', testUserId)
        .single();

      expect(memberError).toBeNull();
      expect(member).toBeDefined();
      expect(member?.role).toBe('owner');
      expect(member?.accepted_at).toBeDefined();
    });
  });

  describe('Repository Operations', () => {
    beforeEach(async () => {
      // Ensure we're authenticated as the test user
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        await supabase.auth.signInWithPassword({
          email: `test-owner-${Date.now()}@test.com`,
          password: 'TestPassword123!'
        });
      }
    });

    it('should allow owner to add repository to workspace', async () => {
      // Add repository to workspace
      const { data: workspaceRepo, error: addError } = await supabase
        .from('workspace_repositories')
        .insert({
          workspace_id: testWorkspaceId,
          repository_id: testRepositoryId,
          added_by: testUserId,
          notes: 'Test repository addition',
          tags: ['test'],
          is_pinned: false
        })
        .select()
        .single();

      expect(addError).toBeNull();
      expect(workspaceRepo).toBeDefined();
      expect(workspaceRepo?.repository_id).toBe(testRepositoryId);
    });

    it('should allow owner to update repository settings', async () => {
      // Update repository settings
      const { data: updated, error: updateError } = await supabase
        .from('workspace_repositories')
        .update({
          notes: 'Updated notes',
          tags: ['updated', 'test'],
          is_pinned: true
        })
        .eq('workspace_id', testWorkspaceId)
        .eq('repository_id', testRepositoryId)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated).toBeDefined();
      expect(updated?.notes).toBe('Updated notes');
      expect(updated?.is_pinned).toBe(true);
    });

    it('should allow owner to remove repository from workspace', async () => {
      // Remove repository from workspace
      const { error: deleteError } = await supabase
        .from('workspace_repositories')
        .delete()
        .eq('workspace_id', testWorkspaceId)
        .eq('repository_id', testRepositoryId);

      expect(deleteError).toBeNull();

      // Verify it was deleted
      const { data: check, error: checkError } = await supabase
        .from('workspace_repositories')
        .select()
        .eq('workspace_id', testWorkspaceId)
        .eq('repository_id', testRepositoryId)
        .single();

      expect(check).toBeNull();
      expect(checkError?.code).toBe('PGRST116'); // No rows found
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate owner member creation without error', async () => {
      // Try to manually insert the owner as a member again
      const { error: duplicateError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: testWorkspaceId,
          user_id: testUserId,
          role: 'owner',
          invited_by: testUserId,
          accepted_at: new Date().toISOString()
        });

      // Should fail due to unique constraint, but not crash
      expect(duplicateError).toBeDefined();
      expect(duplicateError?.code).toBe('23505'); // Unique violation
    });

    it('should prevent non-members from adding repositories', async () => {
      // Create another user
      const { data: authData } = await supabase.auth.signUp({
        email: `non-member-${Date.now()}@test.com`,
        password: 'TestPassword123!'
      });

      const nonMemberId = authData.user?.id || '';

      // Try to add a repository as non-member
      const { error: addError } = await supabase
        .from('workspace_repositories')
        .insert({
          workspace_id: testWorkspaceId,
          repository_id: testRepositoryId,
          added_by: nonMemberId
        });

      expect(addError).toBeDefined();
      expect(addError?.code).toBe('42501'); // RLS violation

      // Clean up
      await supabase.auth.signOut();
    });
  });
});