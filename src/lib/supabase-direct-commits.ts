import { supabase } from './supabase';

/**
 * Database-first direct commits analysis to avoid GitHub API rate limiting
 * Falls back to empty data if no commits are cached yet
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
 * Fetch direct commits data from Supabase database first, with empty fallback
 * This avoids the expensive GitHub API calls that fetchDirectCommits makes
 */
export async function fetchDirectCommitsWithDatabaseFallback(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<DirectCommitsResult> {
  console.log(`[Direct Commits] Starting database-first fetch for ${owner}/${repo}`);
  
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

    // Calculate date range
    const days = parseInt(timeRange) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Query for direct commits (commits not associated with a PR)
    const { data: directCommits, error: directCommitsError } = await supabase
      .from('commits')
      .select(`
        id,
        sha,
        authored_at,
        author_id,
        is_direct_commit,
        contributors!commits_author_id_fkey(
          username,
          avatar_url
        )
      `)
      .eq('repository_id', repoData.id)
      .eq('is_direct_commit', true)
      .gte('authored_at', since.toISOString())
      .order('authored_at', { ascending: false });

    if (directCommitsError) {
      console.warn(`[Direct Commits] Database query failed: ${directCommitsError.message}`);
      return getEmptyDirectCommitsResult();
    }

    if (!directCommits || directCommits.length === 0) {
      console.log(`[Direct Commits] No direct commits found in database for ${owner}/${repo}`);
      return getEmptyDirectCommitsResult();
    }

    // Query for all commits to calculate percentages
    const { data: allCommits, error: allCommitsError } = await supabase
      .from('commits')
      .select(`
        id,
        author_id,
        contributors!commits_author_id_fkey(
          username,
          avatar_url
        )
      `)
      .eq('repository_id', repoData.id)
      .gte('authored_at', since.toISOString());

    if (allCommitsError) {
      console.warn(`[Direct Commits] Failed to fetch all commits: ${allCommitsError.message}`);
      return getEmptyDirectCommitsResult();
    }

    // Process the data to calculate YOLO coder stats
    const stats = calculateYoloCoderStats(directCommits, allCommits || []);
    
    console.log(`[Direct Commits] Found ${directCommits.length} direct commits for ${owner}/${repo}`);
    
    return {
      hasYoloCoders: stats.length > 0,
      yoloCoderStats: stats
    };

  } catch (error) {
    console.error(`[Direct Commits] Database error:`, error);
    return getEmptyDirectCommitsResult();
  }
}

function calculateYoloCoderStats(directCommits: any[], allCommits: any[]) {
  // Count commits by author
  const directCommitsByAuthor = new Map<string, { count: number; contributor: any }>();
  const totalCommitsByAuthor = new Map<string, number>();

  // Count direct commits
  directCommits.forEach(commit => {
    if (commit.contributors && commit.author_id) {
      const authorId = commit.author_id;
      if (!directCommitsByAuthor.has(authorId)) {
        directCommitsByAuthor.set(authorId, {
          count: 0,
          contributor: commit.contributors
        });
      }
      directCommitsByAuthor.get(authorId)!.count++;
    }
  });

  // Count total commits
  allCommits.forEach(commit => {
    if (commit.author_id) {
      const authorId = commit.author_id;
      totalCommitsByAuthor.set(authorId, (totalCommitsByAuthor.get(authorId) || 0) + 1);
    }
  });

  // Calculate percentages and build stats
  const yoloCoderStats: Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalCommits: number;
    directCommitPercentage: number;
  }> = [];

  directCommitsByAuthor.forEach((data, authorId) => {
    const totalCommits = totalCommitsByAuthor.get(authorId) || data.count;
    const directCommitPercentage = (data.count / totalCommits) * 100;
    
    // Only include if they have significant direct commit activity
    if (data.count >= 2 && directCommitPercentage >= 10) {
      yoloCoderStats.push({
        login: data.contributor.username || 'unknown',
        avatar_url: data.contributor.avatar_url || '',
        directCommits: data.count,
        totalCommits,
        directCommitPercentage: Math.round(directCommitPercentage)
      });
    }
  });

  // Sort by direct commit percentage, then by direct commit count
  return yoloCoderStats.sort((a, b) => {
    if (b.directCommitPercentage !== a.directCommitPercentage) {
      return b.directCommitPercentage - a.directCommitPercentage;
    }
    return b.directCommits - a.directCommits;
  });
}

function getEmptyDirectCommitsResult(): DirectCommitsResult {
  return {
    hasYoloCoders: false,
    yoloCoderStats: []
  };
}