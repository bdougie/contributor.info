import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Reset the analyzer's counters before each test
    ContributionAnalyzer.resetCounts();
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

  // New tests for distribution functionality
  
  it('should return default distribution when no PRs are analyzed', () => {
    const distribution = ContributionAnalyzer.getDistribution();
    
    expect(distribution.refinement).toBe(25);
    expect(distribution.newStuff).toBe(25);
    expect(distribution.maintenance).toBe(25);
    expect(distribution.refactoring).toBe(25);
  });
  
  it('should reset counts when resetCounts is called', () => {
    // First analyze some PRs
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(20, 100)); // refinement
    
    // Then reset counts
    ContributionAnalyzer.resetCounts();
    
    // Get the counts, which should be zero
    const counts = ContributionAnalyzer.getCounts();
    
    expect(counts.refinement).toBe(0);
    expect(counts.newStuff).toBe(0);
    expect(counts.maintenance).toBe(0);
    expect(counts.refactoring).toBe(0);
  });
  
  it('should track counts for each quadrant correctly', () => {
    // Analyze multiple PRs covering different quadrants
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(20, 100)); // refinement
    ContributionAnalyzer.analyze(createMockPR(50, 50));  // refactoring
    ContributionAnalyzer.analyze(createMockPR(0, 0, [{ language: 'json', additions: 50, deletions: 20 }])); // maintenance
    
    // Get the counts
    const counts = ContributionAnalyzer.getCounts();
    
    // Verify counts
    expect(counts.newStuff).toBe(2);
    expect(counts.refinement).toBe(1);
    expect(counts.refactoring).toBe(1);
    expect(counts.maintenance).toBe(1);
  });
  
  it('should calculate distribution percentages correctly', () => {
    // Analyze multiple PRs with known distribution
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff
    ContributionAnalyzer.analyze(createMockPR(100, 20)); // newStuff (4 total)
    
    ContributionAnalyzer.analyze(createMockPR(20, 100)); // refinement
    ContributionAnalyzer.analyze(createMockPR(20, 100)); // refinement (2 total)
    
    ContributionAnalyzer.analyze(createMockPR(50, 50)); // refactoring
    ContributionAnalyzer.analyze(createMockPR(50, 50)); // refactoring (2 total)
    
    ContributionAnalyzer.analyze(createMockPR(0, 0, [{ language: 'json', additions: 50, deletions: 20 }])); // maintenance
    ContributionAnalyzer.analyze(createMockPR(0, 0, [{ language: 'json', additions: 50, deletions: 20 }])); // maintenance (2 total)
    
    // Total: 10 PRs - 40% newStuff, 20% refinement, 20% refactoring, 20% maintenance
    
    // Get the distribution
    const distribution = ContributionAnalyzer.getDistribution();
    
    // Verify percentages
    expect(distribution.newStuff).toBe(40);
    expect(distribution.refinement).toBe(20);
    expect(distribution.refactoring).toBe(20);
    expect(distribution.maintenance).toBe(20);
  });
});