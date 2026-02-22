import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRelativeTime,
  transformRAGItems,
  type RAGItem,
} from '../../agents/semantic-search-tool.mts';

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns minutes for < 60 minutes', () => {
    const thirtyMinAgo = new Date('2026-02-21T11:30:00Z').toISOString();
    expect(formatRelativeTime(thirtyMinAgo)).toBe('30m ago');
  });

  it('returns hours for < 24 hours', () => {
    const sixHoursAgo = new Date('2026-02-21T06:00:00Z').toISOString();
    expect(formatRelativeTime(sixHoursAgo)).toBe('6h ago');
  });

  it('returns days for < 30 days', () => {
    const tenDaysAgo = new Date('2026-02-11T12:00:00Z').toISOString();
    expect(formatRelativeTime(tenDaysAgo)).toBe('10d ago');
  });

  it('returns months for < 12 months', () => {
    const threeMonthsAgo = new Date('2025-11-21T12:00:00Z').toISOString();
    expect(formatRelativeTime(threeMonthsAgo)).toBe('3mo ago');
  });

  it('returns years for >= 12 months', () => {
    const twoYearsAgo = new Date('2024-02-21T12:00:00Z').toISOString();
    expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago');
  });

  it('returns 0m ago for timestamps at current time', () => {
    const now = new Date('2026-02-21T12:00:00Z').toISOString();
    expect(formatRelativeTime(now)).toBe('0m ago');
  });

  it('returns "just now" for future dates', () => {
    const future = new Date('2027-01-01T00:00:00Z').toISOString();
    expect(formatRelativeTime(future)).toBe('just now');
  });

  it('returns "just now" for invalid date strings', () => {
    expect(formatRelativeTime('not-a-date')).toBe('just now');
  });
});

// ---------------------------------------------------------------------------
// transformRAGItems
// ---------------------------------------------------------------------------

describe('transformRAGItems', () => {
  function makeItem(overrides: Partial<RAGItem> = {}): RAGItem {
    return {
      item_type: 'pull_request',
      id: 'abc-123',
      title: 'Fix login bug',
      number: 42,
      similarity: 0.85,
      url: 'https://github.com/owner/repo/pull/42',
      state: 'open',
      repository_name: 'repo',
      body_preview: 'This fixes the login issue',
      created_at: '2026-02-21T10:00:00Z',
      author_login: 'testuser',
      ...overrides,
    };
  }

  it('maps pull_request type to PR', () => {
    const result = transformRAGItems([makeItem()]);
    expect(result[0].type).toBe('PR');
  });

  it('preserves non-pull_request types as-is', () => {
    const result = transformRAGItems([makeItem({ item_type: 'issue' })]);
    expect(result[0].type).toBe('issue');
  });

  it('maps all fields correctly', () => {
    const result = transformRAGItems([makeItem()]);
    expect(result[0]).toMatchObject({
      number: 42,
      title: 'Fix login bug',
      url: 'https://github.com/owner/repo/pull/42',
      state: 'open',
      author: 'testuser',
      similarity: 0.85,
    });
  });

  it('handles null author_login', () => {
    const result = transformRAGItems([makeItem({ author_login: null })]);
    expect(result[0].author).toBeNull();
  });

  it('handles null created_at', () => {
    const result = transformRAGItems([makeItem({ created_at: null })]);
    expect(result[0].age).toBeNull();
  });

  it('handles null body_preview', () => {
    const result = transformRAGItems([makeItem({ body_preview: null })]);
    expect(result[0].bodyPreview).toBeNull();
  });

  it('replaces newlines in body_preview', () => {
    const result = transformRAGItems([makeItem({ body_preview: 'line1\nline2\nline3' })]);
    expect(result[0].bodyPreview).toBe('line1 line2 line3');
  });

  it('transforms multiple items', () => {
    const items = [
      makeItem({ number: 1 }),
      makeItem({ number: 2, item_type: 'issue' }),
      makeItem({ number: 3, item_type: 'discussion' }),
    ];
    const result = transformRAGItems(items);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.type)).toEqual(['PR', 'issue', 'discussion']);
  });

  it('returns empty array for empty input', () => {
    expect(transformRAGItems([])).toEqual([]);
  });
});
