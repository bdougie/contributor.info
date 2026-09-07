/**
 * Tests for workspace permission resolution.
 * Regression: owner_id and workspace_members.user_id hold app_users ids,
 * so comparing them against the auth user id denied every owner.
 */

import { describe, it, expect } from 'vitest';
import { resolveWorkspacePermissions, permissionsForRole } from '../workspace-permissions';

const AUTH_ID = 'auth-user-1';
const APP_ID = 'app-user-1';

describe('resolveWorkspacePermissions', () => {
  it('recognises the owner when owner_id holds the app user id', () => {
    const permissions = resolveWorkspacePermissions({
      authUserId: AUTH_ID,
      appUserId: APP_ID,
      ownerId: APP_ID,
      memberRole: null,
    });

    expect(permissions.role).toBe('owner');
    expect(permissions.canRemoveContributors).toBe(true);
    expect(permissions.canManageMembers).toBe(true);
  });

  it('still recognises a pre-migration owner_id that holds the auth user id', () => {
    const permissions = resolveWorkspacePermissions({
      authUserId: AUTH_ID,
      appUserId: APP_ID,
      ownerId: AUTH_ID,
      memberRole: null,
    });

    expect(permissions.role).toBe('owner');
  });

  it('uses the membership role when the user is not the owner', () => {
    const permissions = resolveWorkspacePermissions({
      authUserId: AUTH_ID,
      appUserId: APP_ID,
      ownerId: 'someone-else',
      memberRole: 'viewer',
    });

    expect(permissions.role).toBe('viewer');
    expect(permissions.canAddContributors).toBe(false);
    expect(permissions.isAuthenticated).toBe(true);
  });

  it('denies a signed-in user with no app user row and no ownership', () => {
    const permissions = resolveWorkspacePermissions({
      authUserId: AUTH_ID,
      appUserId: null,
      ownerId: 'someone-else',
      memberRole: null,
    });

    expect(permissions.isAuthenticated).toBe(true);
    expect(permissions.role).toBeNull();
    expect(permissions.canRemoveContributors).toBe(false);
  });

  it('reports unauthenticated when there is no session', () => {
    const permissions = resolveWorkspacePermissions({
      authUserId: null,
      appUserId: null,
      ownerId: APP_ID,
      memberRole: null,
    });

    expect(permissions.isAuthenticated).toBe(false);
    expect(permissions.role).toBeNull();
  });
});

describe('permissionsForRole', () => {
  it.each([
    ['owner', true, true],
    ['admin', true, true],
    ['maintainer', true, true],
    ['editor', true, false],
    ['contributor', false, false],
    ['viewer', false, false],
  ] as const)('%s', (role, canEditContributors, canManageMembers) => {
    const permissions = permissionsForRole(role);
    expect(permissions.canAddContributors).toBe(canEditContributors);
    expect(permissions.canRemoveContributors).toBe(canEditContributors);
    expect(permissions.canManageMembers).toBe(canManageMembers);
    expect(permissions.isAuthenticated).toBe(true);
  });
});
