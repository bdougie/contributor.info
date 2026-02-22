import { describe, it, expect } from 'vitest';
import {
  computePRUrgency,
  computeHealthFactors,
  type PRUrgencyInput,
  type MergedPRData,
} from '../../agents/repo-health-agent.mts';

// ---------------------------------------------------------------------------
// computePRUrgency
// ---------------------------------------------------------------------------

describe('computePRUrgency', () => {
  const now = new Date('2025-02-21T12:00:00Z');

  function makePR(overrides: Partial<PRUrgencyInput> = {}): PRUrgencyInput {
    return {
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      additions: 0,
      deletions: 0,
      ...overrides,
    };
  }

  function daysAgo(days: number): string {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  it('returns low urgency for a brand-new, small PR', () => {
    const result = computePRUrgency(makePR(), now);
    expect(result.urgency).toBe('low');
    expect(result.urgencyScore).toBe(0);
    expect(result.reasons).toEqual(['Needs review']);
  });

  it('scores age contribution: 7 days open adds 14 points', () => {
    const result = computePRUrgency(makePR({ created_at: daysAgo(7) }), now);
    expect(result.daysSinceCreated).toBe(7);
    expect(result.urgencyScore).toBeGreaterThanOrEqual(14);
    expect(result.reasons).toContain('Open for 7 days');
  });

  it('caps age score at 40 regardless of PR age', () => {
    // 50 days old: 50*2=100, capped at 40
    const result = computePRUrgency(makePR({ created_at: daysAgo(50) }), now);
    // Age contribution capped at 40
    const ageContribution = Math.min(50 * 2, 40);
    expect(result.urgencyScore).toBeGreaterThanOrEqual(ageContribution);
  });

  it('adds staleness score when no updates for 3+ days', () => {
    const pr = makePR({ created_at: daysAgo(1), updated_at: daysAgo(4) });
    const result = computePRUrgency(pr, now);
    expect(result.reasons).toContain('No updates for 4 days');
    // 4 days * 3 = 12
    expect(result.urgencyScore).toBeGreaterThanOrEqual(12);
  });

  it('adds 20 points for very large PRs (> 1000 lines)', () => {
    const result = computePRUrgency(makePR({ additions: 800, deletions: 300 }), now);
    expect(result.linesChanged).toBe(1100);
    expect(result.reasons).toContain('Very large PR');
    expect(result.urgencyScore).toBeGreaterThanOrEqual(20);
  });

  it('classifies urgency as medium at threshold 30', () => {
    // No age (< 7 days), no staleness, large PR (20) + stale 4 days (12) = 32
    const pr = makePR({
      created_at: daysAgo(1),
      updated_at: daysAgo(4),
      additions: 600,
      deletions: 500,
    });
    const result = computePRUrgency(pr, now);
    expect(result.urgency).toBe('medium');
  });

  it('classifies urgency as high at threshold 50', () => {
    // 14 days old = 28 (age, capped at 40 if >=20 days), here 14*2=28
    // stale 10 days = 30 → total 58 → high
    const pr = makePR({ created_at: daysAgo(14), updated_at: daysAgo(10) });
    const result = computePRUrgency(pr, now);
    expect(result.urgencyScore).toBeGreaterThanOrEqual(50);
    expect(result.urgency).toBe('high');
  });

  it('classifies urgency as critical at threshold 70', () => {
    // 25 days old (age capped at 40) + stale 12 days (36) + large PR (20) = 96 → critical
    const pr = makePR({
      created_at: daysAgo(25),
      updated_at: daysAgo(12),
      additions: 600,
      deletions: 500,
    });
    const result = computePRUrgency(pr, now);
    expect(result.urgency).toBe('critical');
  });

  it('caps urgencyScore at 100', () => {
    const pr = makePR({
      created_at: daysAgo(30),
      updated_at: daysAgo(20),
      additions: 800,
      deletions: 500,
    });
    const result = computePRUrgency(pr, now);
    expect(result.urgencyScore).toBeLessThanOrEqual(100);
  });

  it('handles null additions/deletions gracefully', () => {
    const pr = makePR({ additions: null, deletions: null });
    const result = computePRUrgency(pr, now);
    expect(result.linesChanged).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHealthFactors
// ---------------------------------------------------------------------------

describe('computeHealthFactors', () => {
  function makeMergedPR(createdDaysAgo: number, mergedDaysLater: number): MergedPRData {
    const base = new Date('2025-02-21T12:00:00Z');
    const created = new Date(base.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);
    const merged = new Date(created.getTime() + mergedDaysLater * 24 * 60 * 60 * 1000);
    return { created_at: created.toISOString(), merged_at: merged.toISOString() };
  }

  it('omits merge time factor and scores remaining two factors when no merged PRs', () => {
    const result = computeHealthFactors([], 0, 0, 0);
    // No merge time factor (no merged PRs); activity (critical=30) + response (good=100)
    expect(result.factors).toHaveLength(2);
    expect(result.factors.map((f) => f.name)).toEqual(['Activity Level', 'Response Time']);
    // overallScore = round((30 + 100) / 2) = 65
    expect(result.overallScore).toBe(65);
  });

  it('gives good activity score when weekly PRs >= 3', () => {
    const result = computeHealthFactors([], 5, 0, 0);
    const activity = result.factors.find((f) => f.name === 'Activity Level');
    expect(activity?.score).toBe(100);
    expect(activity?.status).toBe('good');
  });

  it('gives warning activity score when weekly PRs is 1-2', () => {
    const result = computeHealthFactors([], 2, 0, 0);
    const activity = result.factors.find((f) => f.name === 'Activity Level');
    expect(activity?.score).toBe(70);
    expect(activity?.status).toBe('warning');
  });

  it('gives critical activity score and recommendation when no weekly PRs', () => {
    const result = computeHealthFactors([], 0, 0, 0);
    const activity = result.factors.find((f) => f.name === 'Activity Level');
    expect(activity?.score).toBe(30);
    expect(activity?.status).toBe('critical');
    expect(result.recommendations).toContain('No activity in the past week');
  });

  it('gives good merge time score for fast merges (< 24h)', () => {
    const prs = [makeMergedPR(5, 0.5)]; // merged in 12 hours
    const result = computeHealthFactors(prs, 3, 0, 10);
    const mergeTime = result.factors.find((f) => f.name === 'PR Merge Time');
    expect(mergeTime?.score).toBe(100);
    expect(mergeTime?.status).toBe('good');
  });

  it('gives warning merge time score for slow merges (24-72h)', () => {
    const prs = [makeMergedPR(5, 2)]; // merged in 48 hours
    const result = computeHealthFactors(prs, 3, 0, 10);
    const mergeTime = result.factors.find((f) => f.name === 'PR Merge Time');
    expect(mergeTime?.score).toBe(85);
  });

  it('gives warning merge time score and recommendation for 72-168h merges', () => {
    const prs = [makeMergedPR(10, 5)]; // merged in 5 days = 120 hours
    const result = computeHealthFactors(prs, 3, 0, 10);
    const mergeTime = result.factors.find((f) => f.name === 'PR Merge Time');
    expect(mergeTime?.score).toBe(70);
    expect(result.recommendations).toContain('Consider streamlining PR review process');
  });

  it('gives critical merge time score and SLA recommendation for > 168h merges', () => {
    const prs = [makeMergedPR(15, 8)]; // merged in 8 days = 192 hours
    const result = computeHealthFactors(prs, 3, 0, 10);
    const mergeTime = result.factors.find((f) => f.name === 'PR Merge Time');
    expect(mergeTime?.score).toBe(50);
    expect(mergeTime?.status).toBe('critical');
    expect(result.recommendations).toContain('PR merge times are high - consider review SLAs');
  });

  it('gives good response score when stale ratio is low (< 25%)', () => {
    const result = computeHealthFactors([], 3, 1, 10); // 10% stale
    const response = result.factors.find((f) => f.name === 'Response Time');
    expect(response?.score).toBe(100);
    expect(response?.status).toBe('good');
  });

  it('gives warning response score for 25-50% stale ratio', () => {
    const result = computeHealthFactors([], 3, 3, 10); // 30% stale
    const response = result.factors.find((f) => f.name === 'Response Time');
    expect(response?.score).toBe(75);
    expect(response?.status).toBe('warning');
  });

  it('gives critical response score and recommendation for > 50% stale', () => {
    const result = computeHealthFactors([], 3, 6, 10); // 60% stale
    const response = result.factors.find((f) => f.name === 'Response Time');
    expect(response?.score).toBe(50);
    expect(response?.status).toBe('critical');
    expect(result.recommendations).toContain('Many PRs are stale - establish response time SLAs');
  });

  it('computes overall score as average of all factors', () => {
    // No mergedPRs (no merge time factor), 5 weekly PRs (100), 0 stale of 10 (100)
    // Overall = (100 + 100) / 2 = 100
    const result = computeHealthFactors([], 5, 0, 10);
    expect(result.overallScore).toBe(100);
  });

  it('handles zero totalOpenPRs without dividing by zero', () => {
    const result = computeHealthFactors([], 3, 0, 0);
    const response = result.factors.find((f) => f.name === 'Response Time');
    expect(response?.score).toBe(100); // staleRatio = 0
  });
});
