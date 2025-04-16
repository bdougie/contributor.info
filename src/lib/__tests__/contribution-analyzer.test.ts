import { describe, it, expect, vi } from 'vitest';
import { ContributionAnalyzer } from '../contribution-analyzer';
import type { PullRequest } from '../types';

describe('ContributionAnalyzer', () => {
  const createMockPR = (additions: number, deletions: number, commits?: Array<{ language: string, additions: number, deletions: number }>): PullRequest => ({
    id: 1,
    number: 101,
    title: 'Test PR',
    state: 'closed',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-02T10:00:00Z',
    merged_at: '2025-04-02T10:00:00Z',
    additions,
    deletions,
    repository_owner: 'testowner',
    repository_name: 'testrepo',
    user: {
      id: 1001,
      login: 'testuser',
      avatar_url: 'https://github.com/testuser.png',
    },
    commits
  });

  // Mock Math.random to return predictable values for tests
  const originalRandom = Math.random;
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.spyOn(Math, 'random').mockRestore();
  });

  it('should analyze PR with mostly additions as newStuff', () => {
    const pr = createMockPR(100, 20);
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('newStuff');
    expect(result.x).toBeGreaterThan(50); // More additions should result in higher x
    expect(result.y).toBeLessThan(50);    // Fewer deletions should result in lower y
  });

  it('should analyze PR with mostly deletions as refinement', () => {
    const pr = createMockPR(20, 100);
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('refinement');
    expect(result.x).toBeLessThan(50);   // Fewer additions should result in lower x
    expect(result.y).toBeLessThan(50);   // More deletions result in lower y in the refinement algorithm
  });

  it('should analyze PR with balanced changes as refactoring', () => {
    const pr = createMockPR(50, 50);
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('refactoring');
    expect(result.x).toBeGreaterThanOrEqual(5);
    expect(result.x).toBeLessThanOrEqual(95);
    expect(result.y).toBeGreaterThanOrEqual(5);
    expect(result.y).toBeLessThanOrEqual(95);
  });

  it('should analyze config-only changes as maintenance', () => {
    const pr = createMockPR(0, 0, [
      { language: 'json', additions: 50, deletions: 20 },
      { language: 'yaml', additions: 30, deletions: 10 }
    ]);
    
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('maintenance');
    expect(result.x).toBeGreaterThanOrEqual(5);
    expect(result.x).toBeLessThanOrEqual(45);
    expect(result.y).toBeGreaterThanOrEqual(55);
    expect(result.y).toBeLessThanOrEqual(95);
  });

  it('should analyze PR with mixed code and config as normal', () => {
    const pr = createMockPR(0, 0, [
      { language: 'json', additions: 10, deletions: 5 },
      { language: 'typescript', additions: 90, deletions: 15 }
    ]);
    
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('newStuff');
    expect(result.x).toBeGreaterThan(50);
    expect(result.y).toBeLessThan(50);
  });

  it('should handle PR with zero changes', () => {
    const pr = createMockPR(0, 0);
    const result = ContributionAnalyzer.analyze(pr);
    
    expect(result.quadrant).toBe('maintenance');
  });
});