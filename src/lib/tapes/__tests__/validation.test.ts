/**
 * Tapes session validation tests
 * Tests pure validation and row-building functions for session ingest
 *
 * Following bulletproof testing guidelines - synchronous tests only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidSessionNode, buildSessionRow, MAX_BATCH_SIZE } from '../validation';

describe('isValidSessionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept a valid user session node', () => {
    const node = { project: 'owner/repo', role: 'user', content: 'Hello' };
    expect(isValidSessionNode(node)).toBe(true);
  });

  it('should accept a valid assistant session node', () => {
    const node = { project: 'owner/repo', role: 'assistant', content: 'Response here' };
    expect(isValidSessionNode(node)).toBe(true);
  });

  it('should reject nodes with missing project', () => {
    const node = { project: '', role: 'user', content: 'Hello' };
    expect(isValidSessionNode(node)).toBe(false);
  });

  it('should reject nodes with missing role', () => {
    const node = { project: 'owner/repo', role: '', content: 'Hello' };
    expect(isValidSessionNode(node)).toBe(false);
  });

  it('should reject nodes with missing content', () => {
    const node = { project: 'owner/repo', role: 'user', content: '' };
    expect(isValidSessionNode(node)).toBe(false);
  });

  it('should reject invalid roles', () => {
    const node = { project: 'owner/repo', role: 'system', content: 'Hello' };
    expect(isValidSessionNode(node)).toBe(false);
  });

  it('should reject invalid project formats', () => {
    expect(isValidSessionNode({ project: 'noslash', role: 'user', content: 'x' })).toBe(false);
    expect(isValidSessionNode({ project: 'a/b/c', role: 'user', content: 'x' })).toBe(false);
    expect(isValidSessionNode({ project: 'has spaces/repo', role: 'user', content: 'x' })).toBe(
      false
    );
  });

  it('should accept projects with dots, hyphens, underscores', () => {
    expect(isValidSessionNode({ project: 'my-org/my.repo_v2', role: 'user', content: 'x' })).toBe(
      true
    );
    expect(isValidSessionNode({ project: 'org_1/repo-2.0', role: 'assistant', content: 'y' })).toBe(
      true
    );
  });
});

describe('buildSessionRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build a row with all fields provided', () => {
    const node = {
      project: 'owner/repo',
      role: 'user',
      content: 'Hello',
      model: 'gpt-4',
      session_hash: 'abc123',
      token_count: 42,
    };
    const row = buildSessionRow(node);
    expect(row).toEqual({
      project: 'owner/repo',
      app: 'contributor-info',
      session_hash: 'abc123',
      role: 'user',
      content: 'Hello',
      model: 'gpt-4',
      token_count: 42,
    });
  });

  it('should default optional fields to null/0', () => {
    const node = { project: 'owner/repo', role: 'assistant', content: 'Response' };
    const row = buildSessionRow(node);
    expect(row.session_hash).toBeNull();
    expect(row.model).toBeNull();
    expect(row.token_count).toBe(0);
  });

  it('should always set app to contributor-info', () => {
    const node = { project: 'a/b', role: 'user', content: 'c' };
    expect(buildSessionRow(node).app).toBe('contributor-info');
  });
});

describe('MAX_BATCH_SIZE', () => {
  it('should be 100', () => {
    expect(MAX_BATCH_SIZE).toBe(100);
  });
});
