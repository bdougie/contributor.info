import { supabase } from './supabase';
import { smartCommitAnalyzer } from './progressive-capture/smart-commit-analyzer';
import { trackDatabaseOperation } from './simple-logging';
// Removed Sentry import - using simple logging instead

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
          // Simple breadcrumb logging without analytics
          console.log('Direct commits breadcrumb:', {
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
        // Simple breadcrumb logging without analytics
        console.log('Direct commits breadcrumb:', {
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
        // Simple error logging without analytics
        console.error('Direct commits error:', {
          owner,
          repo,
          timeRange,
          error: error instanceof Error ? error.message : String(error)
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