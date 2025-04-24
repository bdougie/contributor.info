import { useState, useEffect } from 'react';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';
import type { PullRequest, QuadrantDistribution } from '@/lib/types';

/**
 * Hook for analyzing contributions and calculating distribution metrics
 * @param pullRequests - Array of pull requests to analyze
 */
export function useContribution(pullRequests: PullRequest[]) {
  const [distribution, setDistribution] = useState<QuadrantDistribution | null>(null);
  const [quadrantCounts, setQuadrantCounts] = useState<Record<string, number>>({
    refinement: 0,
    newStuff: 0,
    refactoring: 0,
    maintenance: 0
  });
  
  useEffect(() => {
    if (pullRequests.length === 0) return;
    
    // Reset analyzer counts
    ContributionAnalyzer.resetCounts();
    
    // Analyze each PR
    pullRequests.forEach(pr => {
      ContributionAnalyzer.analyze(pr);
    });
    
    // Get the distribution and counts
    setDistribution(ContributionAnalyzer.getDistribution());
    setQuadrantCounts(ContributionAnalyzer.getCounts());
  }, [pullRequests]);
  
  /**
   * Calculate the total number of contributions analyzed
   */
  const getTotalContributions = (): number => {
    return Object.values(quadrantCounts).reduce((sum, count) => sum + count, 0);
  };
  
  return { 
    distribution, 
    quadrantCounts,
    getTotalContributions
  };
}