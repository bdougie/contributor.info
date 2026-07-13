import { describe, it, expect } from 'vitest';
import {
  toOrgImportRepo,
  filterEligible,
  sortByMostRecentlyPushed,
  capSelection,
  toStagedRepository,
  type OctokitOrgRepo,
  type OrgImportRepo,
} from './org-import';

function makeRepo(overrides: Partial<OrgImportRepo> = {}): OrgImportRepo {
  return {
    githubId: 1,
    name: 'repo',
    fullName: 'acme/repo',
    owner: 'acme',
    description: null,
    stargazersCount: 0,
    language: null,
    pushedAt: '2026-01-01T00:00:00Z',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    avatarUrl: 'https://github.com/acme.png',
    ...overrides,
  };
}

describe('toOrgImportRepo', () => {
  it('maps octokit fields and fills defaults for missing optionals', () => {
    const raw: OctokitOrgRepo = {
      id: 42,
      name: 'widgets',
      full_name: 'acme/widgets',
      owner: { login: 'acme', avatar_url: 'https://avatars.example/acme' },
      description: 'A repo',
      stargazers_count: 7,
      language: 'TypeScript',
      pushed_at: '2026-06-01T00:00:00Z',
      private: true,
      fork: false,
      archived: false,
    };
    const mapped = toOrgImportRepo(raw);
    expect(mapped.githubId).toBe(42);
    expect(mapped.fullName).toBe('acme/widgets');
    expect(mapped.owner).toBe('acme');
    expect(mapped.isPrivate).toBe(true);
    expect(mapped.stargazersCount).toBe(7);
    expect(mapped.avatarUrl).toBe('https://avatars.example/acme');
  });

  it('falls back to owner login from full_name and github avatar when owner is missing', () => {
    const raw: OctokitOrgRepo = { id: 1, name: 'x', full_name: 'acme/x' };
    const mapped = toOrgImportRepo(raw);
    expect(mapped.owner).toBe('acme');
    expect(mapped.avatarUrl).toBe('https://github.com/acme.png');
    expect(mapped.stargazersCount).toBe(0);
    expect(mapped.pushedAt).toBeNull();
  });
});

describe('filterEligible', () => {
  const repos = [
    makeRepo({ fullName: 'a/source' }),
    makeRepo({ fullName: 'a/fork', isFork: true }),
    makeRepo({ fullName: 'a/archived', isArchived: true }),
  ];

  it('hides forks and archived repos by default', () => {
    expect(filterEligible(repos, false).map((r) => r.fullName)).toEqual(['a/source']);
  });

  it('includes forks and archived repos when toggled on', () => {
    expect(filterEligible(repos, true)).toHaveLength(3);
  });
});

describe('sortByMostRecentlyPushed', () => {
  it('sorts descending by pushedAt with null last, without mutating input', () => {
    const older = makeRepo({ fullName: 'a/older', pushedAt: '2025-01-01T00:00:00Z' });
    const newer = makeRepo({ fullName: 'a/newer', pushedAt: '2026-06-01T00:00:00Z' });
    const never = makeRepo({ fullName: 'a/never', pushedAt: null });
    const input = [older, never, newer];
    const sorted = sortByMostRecentlyPushed(input);
    expect(sorted.map((r) => r.fullName)).toEqual(['a/newer', 'a/older', 'a/never']);
    expect(input[0].fullName).toBe('a/older');
  });
});

describe('capSelection', () => {
  it('returns the first N repos when over the cap', () => {
    const repos = [
      makeRepo({ fullName: 'a/1' }),
      makeRepo({ fullName: 'a/2' }),
      makeRepo({ fullName: 'a/3' }),
    ];
    expect(capSelection(repos, 2).map((r) => r.fullName)).toEqual(['a/1', 'a/2']);
  });

  it('returns all repos when under the cap and none when slots are 0 or negative', () => {
    const repos = [makeRepo()];
    expect(capSelection(repos, 5)).toHaveLength(1);
    expect(capSelection(repos, 0)).toHaveLength(0);
    expect(capSelection(repos, -1)).toHaveLength(0);
  });
});

describe('toStagedRepository', () => {
  it('converts to the GitHubRepository shape used by the staging cart', () => {
    const staged = toStagedRepository(
      makeRepo({
        githubId: 9,
        fullName: 'acme/widgets',
        name: 'widgets',
        isPrivate: true,
        stargazersCount: 3,
      })
    );
    expect(staged.id).toBe(9);
    expect(staged.full_name).toBe('acme/widgets');
    expect(staged.owner.login).toBe('acme');
    expect(staged.private).toBe(true);
    expect(staged.stargazers_count).toBe(3);
  });
});
