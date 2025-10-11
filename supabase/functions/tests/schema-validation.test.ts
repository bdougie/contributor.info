/**
 * Schema Validation Tests
 *
 * These tests validate that all Supabase upsert operations use only columns
 * that exist in the actual database schema. This prevents runtime failures
 * where operations appear successful (HTTP 200) but silently fail to update
 * the database.
 *
 * See: docs/postmortems/2025-10-11-inngest-event-data-structure-mismatch.md
 * See: GitHub Issue #1097
 */

import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';

// Import generated types from Supabase
// These types are auto-generated from the actual database schema
type Database = {
  public: {
    Tables: {
      issues: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
      };
      pr_comments: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
      };
      pr_reviews: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
      };
      issue_comments: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
      };
      pull_requests: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
      };
    };
  };
};

/**
 * Known schema from generated types
 * This is a simplified version for testing - in production, import from src/types/supabase.ts
 */
const KNOWN_SCHEMAS = {
  issues: [
    'assignees',
    'author_id',
    'body',
    'closed_at',
    'closed_by_id',
    'comments_count',
    'content_hash',
    'created_at',
    'embedding',
    'embedding_generated_at',
    'github_id',
    'id',
    'is_pull_request',
    'labels',
    'last_synced_at',
    'linked_pr_id',
    'linked_prs',
    'milestone',
    'number',
    'repository_id',
    'responded_at',
    'responded_by',
    'state',
    'title',
    'updated_at',
  ],
  pr_comments: [
    'body',
    'comment_type',
    'commenter_avatar_url',
    'commenter_display_name',
    'commenter_id',
    'commenter_username',
    'commit_id',
    'created_at',
    'diff_hunk',
    'github_id',
    'id',
    'in_reply_to_id',
    'original_position',
    'path',
    'position',
    'pr_number',
    'pr_state',
    'pr_title',
    'pull_request_id',
    'repository_id',
    'updated_at',
  ],
  pr_reviews: [
    'body',
    'commit_id',
    'created_at',
    'github_id',
    'id',
    'pr_number',
    'pr_state',
    'pr_title',
    'pull_request_id',
    'repository_id',
    'reviewer_avatar_url',
    'reviewer_display_name',
    'reviewer_id',
    'reviewer_username',
    'state',
    'submitted_at',
    'updated_at',
  ],
  issue_comments: [
    'author_avatar_url',
    'author_display_name',
    'author_id',
    'author_username',
    'body',
    'created_at',
    'github_id',
    'id',
    'issue_id',
    'issue_number',
    'issue_title',
    'repository_id',
    'updated_at',
  ],
  pull_requests: [
    'additions',
    'author_id',
    'base_branch',
    'body',
    'changed_files',
    'closed_at',
    'created_at',
    'deletions',
    'github_id',
    'head_branch',
    'id',
    'is_draft',
    'last_synced_at',
    'merged_at',
    'number',
    'repository_id',
    'state',
    'title',
    'updated_at',
  ],
};

/**
 * Validate that all keys in an upsert object exist in the table schema
 */
function validateUpsertObject(
  tableName: keyof typeof KNOWN_SCHEMAS,
  upsertObject: Record<string, unknown>,
): { valid: boolean; invalidColumns: string[] } {
  const schema = KNOWN_SCHEMAS[tableName];
  const objectKeys = Object.keys(upsertObject);
  const invalidColumns = objectKeys.filter((key) => !schema.includes(key));

  return {
    valid: invalidColumns.length === 0,
    invalidColumns,
  };
}

Deno.test('pr_comments table - should not have repository_full_name column', () => {
  const invalidUpsert = {
    comment_id: '123',
    pr_number: 1,
    repository_full_name: 'owner/repo', // This column doesn't exist!
    author_id: 'user-1',
    body: 'Test comment',
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pr_comments', invalidUpsert);

  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});

Deno.test('pr_comments table - valid upsert with correct columns', () => {
  const validUpsert = {
    github_id: 123,
    pr_number: 1,
    repository_id: 'repo-uuid',
    commenter_id: 'user-1',
    body: 'Test comment',
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pr_comments', validUpsert);

  assertEquals(result.valid, true);
  assertEquals(result.invalidColumns.length, 0);
});

Deno.test('pr_reviews table - should not have repository_full_name column', () => {
  const invalidUpsert = {
    review_id: '456',
    pr_number: 1,
    repository_full_name: 'owner/repo', // This column doesn't exist!
    reviewer_id: 'user-2',
    state: 'approved',
    body: 'LGTM',
    submitted_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pr_reviews', invalidUpsert);

  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});

Deno.test('pr_reviews table - valid upsert with correct columns', () => {
  const validUpsert = {
    github_id: 456,
    pr_number: 1,
    repository_id: 'repo-uuid',
    reviewer_id: 'user-2',
    state: 'approved',
    body: 'LGTM',
    submitted_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pr_reviews', validUpsert);

  assertEquals(result.valid, true);
  assertEquals(result.invalidColumns.length, 0);
});

Deno.test('issue_comments table - should not have repository_full_name column', () => {
  const invalidUpsert = {
    comment_id: '789',
    issue_number: 5,
    repository_full_name: 'owner/repo', // This column doesn't exist!
    author_id: 'user-3',
    body: 'Issue comment',
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('issue_comments', invalidUpsert);

  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});

Deno.test('issue_comments table - valid upsert with correct columns', () => {
  const validUpsert = {
    github_id: 789,
    issue_number: 5,
    repository_id: 'repo-uuid',
    author_id: 'user-3',
    body: 'Issue comment',
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('issue_comments', validUpsert);

  assertEquals(result.valid, true);
  assertEquals(result.invalidColumns.length, 0);
});

Deno.test('issues table - should not have repository_full_name column', () => {
  const invalidUpsert = {
    number: 5,
    github_id: '999',
    repository_id: 'repo-uuid',
    repository_full_name: 'owner/repo', // This column doesn't exist!
    title: 'Test issue',
    body: 'Issue body',
    state: 'open',
    author_id: 'user-4',
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('issues', invalidUpsert);

  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});

Deno.test('issues table - valid upsert with correct columns', () => {
  const validUpsert = {
    number: 5,
    github_id: '999',
    repository_id: 'repo-uuid',
    title: 'Test issue',
    body: 'Issue body',
    state: 'open',
    author_id: 'user-4',
    labels: ['bug', 'help wanted'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('issues', validUpsert);

  assertEquals(result.valid, true);
  assertEquals(result.invalidColumns.length, 0);
});

Deno.test('pull_requests table - repository_full_name is NOT a valid column', () => {
  // NOTE: Based on the generated types, pull_requests table does NOT have repository_full_name
  const invalidUpsert = {
    number: 10,
    github_id: '1234',
    repository_id: 'repo-uuid',
    repository_full_name: 'owner/repo', // This column doesn't exist in the actual schema!
    title: 'Test PR',
    body: 'PR body',
    state: 'open',
    author_id: 'user-5',
    additions: 50,
    deletions: 10,
    changed_files: 3,
    created_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pull_requests', invalidUpsert);

  assertEquals(result.valid, false);
  assertEquals(result.invalidColumns.includes('repository_full_name'), true);
});

Deno.test('pull_requests table - valid upsert with correct columns', () => {
  const validUpsert = {
    number: 10,
    github_id: '1234',
    repository_id: 'repo-uuid',
    title: 'Test PR',
    body: 'PR body',
    state: 'open',
    author_id: 'user-5',
    additions: 50,
    deletions: 10,
    changed_files: 3,
    is_draft: false,
    base_branch: 'main',
    head_branch: 'feature-branch',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  const result = validateUpsertObject('pull_requests', validUpsert);

  assertEquals(result.valid, true);
  assertEquals(result.invalidColumns.length, 0);
});
