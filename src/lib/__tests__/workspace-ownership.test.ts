import { describe, it, expect } from 'vitest';
import { resolveWorkspaceOwnership } from '../workspace-ownership';

const APP_USER_ID = 'c44084f7-4f3a-450a-aee8-ea30f3480b07';
const AUTH_USER_ID = '1eaf7821-2ead-4711-9727-1983205e7899';
const OTHER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('resolveWorkspaceOwnership', () => {
  it('matches when owner_id equals app_users.id', () => {
    const result = resolveWorkspaceOwnership(APP_USER_ID, APP_USER_ID, AUTH_USER_ID);
    expect(result).toEqual({ isOwner: true, matchType: 'app_user' });
  });

  it('falls back to auth.users.id when app_users.id does not match', () => {
    const result = resolveWorkspaceOwnership(AUTH_USER_ID, APP_USER_ID, AUTH_USER_ID);
    expect(result).toEqual({ isOwner: true, matchType: 'auth_fallback' });
  });

  it('returns not owner when neither ID matches', () => {
    const result = resolveWorkspaceOwnership(OTHER_ID, APP_USER_ID, AUTH_USER_ID);
    expect(result).toEqual({ isOwner: false, matchType: 'none' });
  });

  it('returns not owner when appUserId is null and authUserId does not match', () => {
    const result = resolveWorkspaceOwnership(OTHER_ID, null, AUTH_USER_ID);
    expect(result).toEqual({ isOwner: false, matchType: 'none' });
  });

  it('returns not owner when both IDs are null', () => {
    const result = resolveWorkspaceOwnership(APP_USER_ID, null, null);
    expect(result).toEqual({ isOwner: false, matchType: 'none' });
  });

  it('prefers app_users.id match over auth fallback when both match', () => {
    const sameId = APP_USER_ID;
    const result = resolveWorkspaceOwnership(sameId, sameId, sameId);
    expect(result.matchType).toBe('app_user');
  });

  it('uses auth fallback when appUserId is null but authUserId matches', () => {
    const result = resolveWorkspaceOwnership(AUTH_USER_ID, null, AUTH_USER_ID);
    expect(result).toEqual({ isOwner: true, matchType: 'auth_fallback' });
  });
});
