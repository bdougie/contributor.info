import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWorkspaceDraft,
  getWorkspaceCreationRoute,
  parseRepositoryInput,
  readWorkspaceDraft,
  saveWorkspaceDraft,
} from '../workspace-onboarding';
import { getLoginReturnPath, getLoginRoute } from '@/lib/auth/login-redirect';

describe('workspace onboarding continuity', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it.each([
    ['papercomputeco/tapes', 'papercomputeco/tapes'],
    [' https://github.com/pcc-labs/tapes/ ', 'pcc-labs/tapes'],
    ['https://github.com/pcc-labs/tapes.git?tab=readme-ov-file', 'pcc-labs/tapes'],
    ['tapes', null],
    ['https://example.com/pcc-labs/tapes', null],
    ['https://github.com@evil.test/pcc-labs/tapes', null],
    ['https://github.com/pcc-labs/tapes/issues', null],
    ['//evil.test/tapes', null],
    ['pcc-labs/..', null],
  ])('parses %s safely', (input, expected) => {
    expect(parseRepositoryInput(input)).toBe(expected);
  });

  it('carries the repository through a validated login return URL', () => {
    const destination = getWorkspaceCreationRoute('papercomputeco/tapes');
    const login = new URL(getLoginRoute(destination), window.location.origin);
    expect(login.pathname).toBe('/login');
    expect(login.searchParams.get('redirectTo')).toBe(
      '/workspaces/new?repository=papercomputeco%2Ftapes'
    );
    expect(getLoginReturnPath(login.searchParams.get('redirectTo'))).toBe(destination);
    expect(getWorkspaceCreationRoute('invalid')).toBe('/workspaces/new');
  });

  it.each(['https://evil.test/', '//evil.test/', '/\\evil.test/', 'javascript:alert(1)'])(
    'rejects external redirect %s',
    (input) => {
      expect(getLoginReturnPath(input)).toBe('/');
    }
  );

  it('normalizes same-origin absolute URLs without dropping query parameters', () => {
    expect(getLoginReturnPath(`${window.location.origin}/workspaces/new?repository=a%2Fb`)).toBe(
      '/workspaces/new?repository=a%2Fb'
    );
  });

  it('restores drafts per repository and clears them after completion or cancellation', () => {
    const draft = {
      name: 'Tapes and PCC Labs',
      description: 'Adjacent projects',
      visibility: 'public' as const,
    };
    expect(saveWorkspaceDraft('papercomputeco/tapes', draft)).toBe(true);
    expect(readWorkspaceDraft('PaperComputeCo/Tapes')).toEqual(draft);
    expect(readWorkspaceDraft('pcc-labs/other')).toEqual({});
    clearWorkspaceDraft('papercomputeco/tapes');
    expect(readWorkspaceDraft('papercomputeco/tapes')).toEqual({});
  });

  it('ignores corrupt storage and reports unavailable persistence', () => {
    sessionStorage.setItem('workspace-create-draft:new', '{bad json');
    expect(readWorkspaceDraft(null)).toEqual({});
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    expect(saveWorkspaceDraft(null, { name: 'Tapes', visibility: 'public' })).toBe(false);
    spy.mockRestore();
  });
});
