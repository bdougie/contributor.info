import { describe, it, expect } from 'vitest';
import { seedFromSSR } from '../workspace-ssr-seed';
import type { WorkspaceDetailPageData } from '@/lib/ssr-hydration';

function payload(overrides: Partial<NonNullable<WorkspaceDetailPageData['workspace']>> = {}) {
  const workspace: NonNullable<WorkspaceDetailPageData['workspace']> = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Platform Team',
    slug: 'platform-team',
    description: 'Infra repos',
    tier: 'pro',
    owner_id: 'owner-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    last_activity_at: null,
    visibility: 'public',
    is_active: true,
    max_repositories: 10,
    current_repository_count: 2,
    data_retention_days: 30,
    settings: {},
    repository_count: 2,
    member_count: 4,
    contributor_count: 0,
    repositories: [
      {
        id: 'repo-1',
        full_name: 'acme/api',
        name: 'api',
        owner: 'acme',
        description: 'API',
        language: 'TypeScript',
        stargazers_count: 120,
        forks_count: 7,
        open_issues_count: 3,
        avatar_url: null,
        is_pinned: true,
      },
      {
        id: 'repo-2',
        full_name: 'acme/web',
        name: 'web',
        owner: 'acme',
        description: null,
        language: null,
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        avatar_url: 'https://example.test/avatar.png',
        is_pinned: false,
      },
    ],
    owner: null,
    ...overrides,
  };
  return { workspace };
}

describe('seedFromSSR', () => {
  it('returns null without a payload or a requested id', () => {
    expect(seedFromSSR(null, 'platform-team')).toBeNull();
    expect(seedFromSSR({ workspace: null }, 'platform-team')).toBeNull();
    expect(seedFromSSR(payload(), undefined)).toBeNull();
  });

  it('returns null when the payload describes a different workspace', () => {
    expect(seedFromSSR(payload(), 'other-team')).toBeNull();
  });

  it('matches the slug or the id, case-insensitively', () => {
    expect(seedFromSSR(payload(), 'Platform-Team')).not.toBeNull();
    expect(seedFromSSR(payload(), '11111111-1111-4111-8111-111111111111')).not.toBeNull();
  });

  it('maps the full workspace row so the dashboard can render without a fetch', () => {
    const seed = seedFromSSR(payload(), 'platform-team');
    expect(seed?.workspace).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'platform-team',
      tier: 'pro',
      visibility: 'public',
      max_repositories: 10,
      current_repository_count: 2,
      is_active: true,
    });
    expect(seed?.memberCount).toBe(4);
  });

  it('maps repositories with the fields the repository list renders', () => {
    const seed = seedFromSSR(payload(), 'platform-team');
    expect(seed?.repositories).toHaveLength(2);
    expect(seed?.repositories[0]).toMatchObject({
      id: 'repo-1',
      full_name: 'acme/api',
      stars: 120,
      forks: 7,
      open_issues: 3,
      open_prs: 0,
      is_pinned: true,
      avatar_url: 'https://avatars.githubusercontent.com/acme',
      html_url: 'https://github.com/acme/api',
    });
    expect(seed?.repositories[1]).toMatchObject({
      description: undefined,
      language: undefined,
      avatar_url: 'https://example.test/avatar.png',
    });
  });
});
