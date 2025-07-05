import { supabase } from './supabase';
import { smartCommitAnalyzer } from './progressive-capture/smart-commit-analyzer';
import { trackDatabaseOperation } from './sentry/data-tracking';
import * as Sentry from '@sentry/react';

/**
 * Smart database-first direct commits analysis
 * Uses efficient commit-to-PR association analysis instead of heavy GitHub API calls
 * Falls back to empty data if no commits are analyzed yet
 */

interface DirectCommitsResult {
  hasYoloCoders: boolean;
  yoloCoderStats: Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalCommits: number;
    directCommitPercentage: number;
  }>;
}

/**
 * Fetch direct commits data using smart database analysis
 * This completely avoids the expensive GitHub API calls that the old fetchDirectCommits made
 * Uses the efficient commit analysis results stored in the database
 */
export async function fetchDirectCommitsWithDatabaseFallback(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<DirectCommitsResult> {
  
  return trackDatabaseOperation(
    'fetchDirectCommitsWithDatabaseFallback',
    async () => {
      try {
        // First, get the repository ID
        const { data: repoData, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', repo)
          .single();

        if (repoError || !repoData) {
          Sentry.addBreadcrumb({
            category: 'database',
            message: `Repository not found in database: ${owner}/${repo}`,
            level: 'info',
            data: { owner, repo, error: repoError?.message }
          });
          return getEmptyDirectCommitsResult();
        }

        // Use the smart commit analyzer to get results from database
        const result = await smartCommitAnalyzer.getDirectCommitsFromDatabase(repoData.id, timeRange);
        
        // Track analytics about the results
        Sentry.addBreadcrumb({
          category: 'data_analysis',
          message: `Direct commits analysis completed for ${owner}/${repo}`,
          level: 'info',
          data: {
            yolo_coders_found: result.yoloCoderStats.length,
            has_yolo_coders: result.hasYoloCoders,
            time_range: timeRange
          }
        });
        
        return result;

      } catch (error) {
        Sentry.withScope((scope) => {
          scope.setTag('component', 'direct-commits');
          scope.setContext('direct_commits_analysis', {
            owner,
            repo,
            timeRange
          });
          scope.setLevel('warning');
          Sentry.captureException(error);
        });
        
        return getEmptyDirectCommitsResult();
      }
    },
    {
      operation: 'fetch',
      table: 'direct_commits_analysis',
      repository: `${owner}/${repo}`,
      fallbackUsed: false,
      cacheHit: false
    }
  );
}

function getEmptyDirectCommitsResult(): DirectCommitsResult {
  return {
    hasYoloCoders: false,
    yoloCoderStats: []
  };
}