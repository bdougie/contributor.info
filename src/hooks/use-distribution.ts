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
  debugFiles?: Array<{title: string, number: number, extensions: string[]}>; // Debug info
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
  // Debug information storage
  const [debugInfo, setDebugInfo] = useState<Record<string, Array<{title: string, number: number, extensions: string[]}>>>({
    refinement: [],
    newStuff: [],
    refactoring: [],
    maintenance: []
  });
  
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
      
      // Reset analyzer counts to ensure we're starting fresh
      ContributionAnalyzer.resetCounts();
      
      // Debug tracking for PRs in each quadrant
      const debugQuadrantPRs: Record<string, Array<{title: string, number: number, extensions: string[]}>> = {
        refinement: [],
        newStuff: [],
        refactoring: [],
        maintenance: []
      };
      
      // Analyze each PR
      pullRequests.forEach(pr => {
        // Extract file extensions from commits
        const extensions: string[] = [];
        if (pr.commits && pr.commits.length > 0) {
          pr.commits.forEach(commit => {
            if (commit.language) {
              extensions.push(commit.language);
            }
          });
        } else {
          // Try to infer extensions from PR title
          const titleExtMatch = pr.title.match(/\.([\w]+)/g);
          if (titleExtMatch) {
            titleExtMatch.forEach(ext => extensions.push(ext.substring(1)));
          }
        }
        
        // Analyze PR - this will also increment the internal counts in ContributionAnalyzer
        const result = ContributionAnalyzer.analyze(pr);
        
        // Store info for debugging
        debugQuadrantPRs[result.quadrant].push({
          title: pr.title,
          number: pr.number,
          extensions: extensions.filter((v, i, a) => a.indexOf(v) === i) // Unique extensions
        });
      });
      
      // Store debug info
      setDebugInfo(debugQuadrantPRs);
      
      // Get the distribution and counts from the analyzer
      const newDistribution = ContributionAnalyzer.getDistribution();
      const newCounts = ContributionAnalyzer.getCounts();
      
      // Log for debugging
      console.log("Quadrant counts from analyzer:", newCounts);
      
      // Update state with counts and distribution
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
          color: info.color,
          debugFiles: debugQuadrantPRs[key] // Add debug info to chart data
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
    debugInfo, // Expose debug info
    getDominantQuadrant,
    getTotalContributions
  };
}