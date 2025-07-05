import { supabase } from './supabase';
import { smartCommitAnalyzer } from './progressive-capture/smart-commit-analyzer';

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
  console.log(`[Direct Commits] Starting smart database-first analysis for ${owner}/${repo}`);
  
  try {
    // First, get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.log(`[Direct Commits] Repository not found in database: ${owner}/${repo}`);
      return getEmptyDirectCommitsResult();
    }

    // Use the smart commit analyzer to get results from database
    const result = await smartCommitAnalyzer.getDirectCommitsFromDatabase(repoData.id, timeRange);
    
    if (result.yoloCoderStats.length === 0) {
      console.log(`[Direct Commits] No analyzed commits found for ${owner}/${repo} - may need to queue commit analysis`);
    } else {
      console.log(`[Direct Commits] Found ${result.yoloCoderStats.length} YOLO coders for ${owner}/${repo}`);
    }
    
    return result;

  } catch (error) {
    console.error(`[Direct Commits] Error in smart analysis:`, error);
    return getEmptyDirectCommitsResult();
  }
}

function getEmptyDirectCommitsResult(): DirectCommitsResult {
  return {
    hasYoloCoders: false,
    yoloCoderStats: []
  };
}