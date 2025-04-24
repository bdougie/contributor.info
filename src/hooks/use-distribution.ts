import { useState, useEffect } from 'react';
import type { PullRequest, QuadrantDistribution } from '@/lib/types';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';

/**
 * Interface for quadrant data used in visualizations
 */
export interface QuadrantData {
  id: string;
  label: string;
  value: number;
  percentage: number;
  description: string;
  color: string;
}

/**
 * Hook for analyzing contribution distribution across quadrants
 * @param pullRequests - Array of pull requests to analyze
 */
export function useDistribution(pullRequests: PullRequest[]) {
  const [distribution, setDistribution] = useState<QuadrantDistribution | null>(null);
  const [quadrantCounts, setQuadrantCounts] = useState<Record<string, number>>({
    refinement: 0,
    newStuff: 0,
    refactoring: 0,
    maintenance: 0
  });
  
  const [chartData, setChartData] = useState<QuadrantData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Quadrant descriptions and colors
  const quadrantInfo = {
    refinement: {
      label: 'Refinement',
      description: 'Improving existing features with careful changes',
      color: '#4ade80' // green
    },
    newStuff: {
      label: 'New Features',
      description: 'Adding new functionality and capabilities',
      color: '#60a5fa' // blue
    },
    refactoring: {
      label: 'Refactoring',
      description: 'Restructuring code without changing behavior',
      color: '#f97316' // orange
    },
    maintenance: {
      label: 'Maintenance',
      description: 'Bug fixes and routine upkeep',
      color: '#a78bfa' // purple
    }
  };
  
  useEffect(() => {
    setLoading(true);
    
    try {
      if (pullRequests.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }
      
      // Reset analyzer counts
      ContributionAnalyzer.resetCounts();
      
      // Analyze each PR
      pullRequests.forEach(pr => {
        ContributionAnalyzer.analyze(pr);
      });
      
      // Get the distribution and counts
      const newDistribution = ContributionAnalyzer.getDistribution();
      const newCounts = ContributionAnalyzer.getCounts();
      
      // Use the setState function to update the state
      setDistribution(newDistribution);
      setQuadrantCounts(newCounts);
      
      // Transform data for chart visualization
      const totalContributions = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
      
      const data = Object.entries(newCounts).map(([key, value]) => {
        const info = quadrantInfo[key as keyof typeof quadrantInfo];
        return {
          id: key,
          label: info.label,
          value,
          percentage: totalContributions > 0 ? (value / totalContributions) * 100 : 0,
          description: info.description,
          color: info.color
        };
      });
      
      setChartData(data);
      setError(null);
    } catch (err) {
      console.error('Error analyzing distribution:', err);
      setError(err instanceof Error ? err : new Error('Failed to analyze distribution'));
    } finally {
      setLoading(false);
    }
  }, [pullRequests]);
  
  /**
   * Returns the dominant quadrant (highest percentage)
   */
  const getDominantQuadrant = (): QuadrantData | null => {
    if (chartData.length === 0) return null;
    return chartData.reduce((max, quadrant) => 
      quadrant.value > max.value ? quadrant : max, chartData[0]);
  };
  
  /**
   * Calculate the total number of contributions analyzed
   */
  const getTotalContributions = (): number => {
    return Object.values(quadrantCounts).reduce((sum, count) => sum + count, 0);
  };
  
  return { 
    distribution, 
    quadrantCounts,
    chartData,
    loading,
    error,
    getDominantQuadrant,
    getTotalContributions
  };
}