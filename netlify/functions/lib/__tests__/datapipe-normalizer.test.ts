import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  ContributorsResponse,
  InsightsResponse,
  ActivityResponse,
  DiscoverResponse,
} from '../gh-datapipe-client.mjs';
import {
  normalizeContributors,
  normalizeInsights,
  normalizeActivity,
  normalizeDiscover,
  normalizeAll,
} from '../datapipe-normalizer.mjs';

// Pin Date.now for deterministic generatedAt timestamps
const FIXED_NOW = '2025-06-01T00:00:00.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContributorsResponse(
  overrides: Partial<ContributorsResponse> = {}
): ContributorsResponse {
  return {
    repository: 'open-sauced/app',
    total: 3,
    contributors: [
      {
        login: 'alice',
        confidence_score: 92,
        contribution_quality: 85,
        activity: { prs_opened: 10, prs_merged: 8, reviews_given: 15, issues_opened: 3 },
      },
      {
        login: 'bob',
        confidence_score: null,
        contribution_quality: null,
        activity: { prs_opened: 2, prs_merged: 1, reviews_given: 0, issues_opened: 0 },
      },
      {
        login: 'carol',
        confidence_score: 70,
        contribution_quality: 60,
        activity: { prs_opened: 0, prs_merged: 0, reviews_given: 0, issues_opened: 0 },
      },
    ],
    ...overrides,
  };
}

function makeInsightsResponse(overrides: Partial<InsightsResponse> = {}): InsightsResponse {
  return {
    repository: 'open-sauced/app',
    calculated_at: '2025-05-30T12:00:00Z',
    health: {
      trending_score: 78,
      freshness_status: 'active',
      is_significant_change: false,
    },
    lottery_factor: {
      top_contributors: [
        { login: 'alice', weighted_score: 95, rank: 1 },
        { login: 'bob', weighted_score: 60, rank: 2 },
      ],
    },
    contributor_of_month: {
      login: 'alice',
      score: 150,
      month: '2025-05',
    },
    ...overrides,
  };
}

function makeActivityResponse(overrides: Partial<ActivityResponse> = {}): ActivityResponse {
  return {
    repository: 'open-sauced/app',
    days: 7,
    activity: [
      {
        date: '2025-05-25',
        prs_opened: 3,
        prs_merged: 2,
        reviews: 5,
        issues_opened: 1,
        issues_closed: 0,
      },
      {
        date: '2025-05-26',
        prs_opened: 0,
        prs_merged: 0,
        reviews: 0,
        issues_opened: 0,
        issues_closed: 0,
      },
      {
        date: '2025-05-27',
        prs_opened: 5,
        prs_merged: 4,
        reviews: 8,
        issues_opened: 2,
        issues_closed: 1,
      },
    ],
    ...overrides,
  };
}

function makeDiscoverResponse(overrides: Partial<DiscoverResponse> = {}): DiscoverResponse {
  return {
    config_id: 'cfg-123',
    repositories: [
      {
        owner: 'vercel',
        name: 'next.js',
        language: 'TypeScript',
        stars: 120000,
        description: 'The React Framework',
      },
      { owner: 'denoland', name: 'deno', language: 'Rust', stars: 90000, description: null },
      {
        owner: 'astro',
        name: 'astro',
        language: null,
        stars: 40000,
        description: 'Build fast websites',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeContributors
// ---------------------------------------------------------------------------

describe('normalizeContributors', () => {
  it('produces text with top contributors and activity', () => {
    const result = normalizeContributors(makeContributorsResponse());

    expect(result).not.toBeNull();
    expect(result!.text).toContain('Repository open-sauced/app has 3 contributors');
    expect(result!.text).toContain('alice');
    expect(result!.text).toContain('confidence 92');
    expect(result!.text).toContain('quality 85');
    expect(result!.text).toContain('10 PRs opened');
    expect(result!.text).toContain('8 merged');
    expect(result!.text).toContain('15 reviews');
    expect(result!.text).toContain('3 issues');
    expect(result!.metadata.source).toBe('contributors');
    expect(result!.metadata.repository).toBe('open-sauced/app');
    expect(result!.metadata.generatedAt).toBe(FIXED_NOW);
  });

  it('omits null scores gracefully', () => {
    const data = makeContributorsResponse({
      contributors: [
        {
          login: 'bob',
          confidence_score: null,
          contribution_quality: null,
          activity: { prs_opened: 2, prs_merged: 1, reviews_given: 0, issues_opened: 0 },
        },
      ],
      total: 1,
    });

    const result = normalizeContributors(data);

    expect(result).not.toBeNull();
    expect(result!.text).not.toContain('confidence');
    expect(result!.text).not.toContain('quality');
    expect(result!.text).toContain('bob');
    expect(result!.text).toContain('2 PRs opened');
  });

  it('omits zero-activity fields', () => {
    const data = makeContributorsResponse({
      contributors: [
        {
          login: 'carol',
          confidence_score: 70,
          contribution_quality: 60,
          activity: { prs_opened: 0, prs_merged: 0, reviews_given: 0, issues_opened: 0 },
        },
      ],
      total: 1,
    });

    const result = normalizeContributors(data);

    expect(result).not.toBeNull();
    expect(result!.text).not.toContain('PRs opened');
    expect(result!.text).not.toContain('merged');
    expect(result!.text).not.toContain('reviews');
    expect(result!.text).not.toContain('issues');
  });

  it('returns null for empty contributors array', () => {
    const data = makeContributorsResponse({ contributors: [], total: 0 });
    expect(normalizeContributors(data)).toBeNull();
  });

  it('caps at 10 contributors', () => {
    const contributors = Array.from({ length: 20 }, (_, i) => ({
      login: `user-${i}`,
      confidence_score: 50,
      contribution_quality: 50,
      activity: { prs_opened: 1, prs_merged: 0, reviews_given: 0, issues_opened: 0 },
    }));

    const data = makeContributorsResponse({ contributors, total: 20 });
    const result = normalizeContributors(data);

    expect(result).not.toBeNull();
    expect(result!.text).toContain('user-9');
    expect(result!.text).not.toContain('user-10');
  });
});

// ---------------------------------------------------------------------------
// normalizeInsights
// ---------------------------------------------------------------------------

describe('normalizeInsights', () => {
  it('produces text with health, lottery factor, and contributor of month', () => {
    const result = normalizeInsights(makeInsightsResponse());

    expect(result).not.toBeNull();
    expect(result!.text).toContain('Repository open-sauced/app insights');
    expect(result!.text).toContain('trending score 78');
    expect(result!.text).toContain('freshness active');
    expect(result!.text).not.toContain('significant change');
    expect(result!.text).toContain('alice (rank 1, score 95)');
    expect(result!.text).toContain('Contributor of the month for 2025-05: alice with score 150');
    expect(result!.metadata.source).toBe('insights');
    expect(result!.metadata.calculatedAt).toBe('2025-05-30T12:00:00Z');
  });

  it('includes significant change when detected', () => {
    const data = makeInsightsResponse({
      health: { trending_score: 90, freshness_status: 'stale', is_significant_change: true },
    });

    const result = normalizeInsights(data);
    expect(result!.text).toContain('significant change detected');
  });

  it('returns null when all fields are null', () => {
    const data = makeInsightsResponse({
      health: null,
      lottery_factor: null,
      contributor_of_month: null,
    });

    expect(normalizeInsights(data)).toBeNull();
  });

  it('handles partial data - only health', () => {
    const data = makeInsightsResponse({
      lottery_factor: null,
      contributor_of_month: null,
    });

    const result = normalizeInsights(data);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('trending score');
    expect(result!.text).not.toContain('Lottery factor');
    expect(result!.text).not.toContain('Contributor of the month');
  });
});

// ---------------------------------------------------------------------------
// normalizeActivity
// ---------------------------------------------------------------------------

describe('normalizeActivity', () => {
  it('produces text with aggregate stats and active days', () => {
    const result = normalizeActivity(makeActivityResponse());

    expect(result).not.toBeNull();
    expect(result!.text).toContain('Repository open-sauced/app activity over 7 days');
    expect(result!.text).toContain('8 PRs opened');
    expect(result!.text).toContain('6 merged');
    expect(result!.text).toContain('13 reviews');
    expect(result!.text).toContain('3 issues opened');
    expect(result!.text).toContain('1 issues closed');
    expect(result!.text).toContain('Most active day: 2025-05-27 with 20 events');
    expect(result!.text).toContain('Least active day: 2025-05-26 with 0 events');
    expect(result!.metadata.source).toBe('activity');
    expect(result!.metadata.daysCovered).toBe(7);
  });

  it('returns null for empty activity array', () => {
    const data = makeActivityResponse({ activity: [] });
    expect(normalizeActivity(data)).toBeNull();
  });

  it('handles single day of activity', () => {
    const data = makeActivityResponse({
      activity: [
        {
          date: '2025-05-25',
          prs_opened: 1,
          prs_merged: 1,
          reviews: 0,
          issues_opened: 0,
          issues_closed: 0,
        },
      ],
      days: 1,
    });

    const result = normalizeActivity(data);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('Most active day: 2025-05-25');
    expect(result!.text).toContain('Least active day: 2025-05-25');
  });
});

// ---------------------------------------------------------------------------
// normalizeDiscover
// ---------------------------------------------------------------------------

describe('normalizeDiscover', () => {
  it('produces text with discovered repositories', () => {
    const result = normalizeDiscover(makeDiscoverResponse());

    expect(result).not.toBeNull();
    expect(result!.text).toContain('Discovered repositories (config cfg-123)');
    expect(result!.text).toContain(
      'vercel/next.js - TypeScript - 120000 stars - The React Framework'
    );
    expect(result!.text).toContain('denoland/deno - Rust - 90000 stars');
    expect(result!.text).not.toContain('null');
    expect(result!.metadata.source).toBe('discover');
    expect(result!.metadata.repository).toBe('discovery/cfg-123');
  });

  it('omits null language and description', () => {
    const data = makeDiscoverResponse({
      repositories: [
        { owner: 'astro', name: 'astro', language: null, stars: 40000, description: null },
      ],
    });

    const result = normalizeDiscover(data);
    expect(result).not.toBeNull();
    // Should be "astro/astro - 40000 stars" with no trailing hyphens for null fields
    expect(result!.text).toContain('astro/astro - 40000 stars');
    expect(result!.text).not.toContain('null');
  });

  it('returns null for empty repositories array', () => {
    const data = makeDiscoverResponse({ repositories: [] });
    expect(normalizeDiscover(data)).toBeNull();
  });

  it('caps at 15 repositories', () => {
    const repositories = Array.from({ length: 20 }, (_, i) => ({
      owner: 'org',
      name: `repo-${i}`,
      language: 'Go',
      stars: 1000 - i,
      description: null,
    }));

    const data = makeDiscoverResponse({ repositories });
    const result = normalizeDiscover(data);

    expect(result).not.toBeNull();
    expect(result!.text).toContain('org/repo-14');
    expect(result!.text).not.toContain('org/repo-15');
  });
});

// ---------------------------------------------------------------------------
// normalizeAll
// ---------------------------------------------------------------------------

describe('normalizeAll', () => {
  it('collects all non-null chunks', () => {
    const chunks = normalizeAll({
      contributors: makeContributorsResponse(),
      insights: makeInsightsResponse(),
      activity: makeActivityResponse(),
      discover: makeDiscoverResponse(),
    });

    expect(chunks).toHaveLength(4);
    expect(chunks.map((c) => c.metadata.source)).toEqual([
      'contributors',
      'insights',
      'activity',
      'discover',
    ]);
  });

  it('filters out null inputs', () => {
    const chunks = normalizeAll({
      contributors: null,
      insights: makeInsightsResponse(),
      activity: null,
      discover: makeDiscoverResponse(),
    });

    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.metadata.source)).toEqual(['insights', 'discover']);
  });

  it('filters out inputs that normalize to null', () => {
    const chunks = normalizeAll({
      contributors: makeContributorsResponse({ contributors: [], total: 0 }),
      insights: makeInsightsResponse({
        health: null,
        lottery_factor: null,
        contributor_of_month: null,
      }),
      activity: makeActivityResponse({ activity: [] }),
      discover: makeDiscoverResponse({ repositories: [] }),
    });

    expect(chunks).toHaveLength(0);
  });

  it('returns empty array when all inputs are undefined', () => {
    const chunks = normalizeAll({});
    expect(chunks).toHaveLength(0);
  });
});
