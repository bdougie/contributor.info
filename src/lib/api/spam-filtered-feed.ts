import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type PullRequestWithAuthor = Database['public']['Tables']['pull_requests']['Row'] & {
  author: Database['public']['Tables']['contributors']['Row'];
  repository: Database['public']['Tables']['repositories']['Row'];
};

export interface SpamFilterOptions {
  maxSpamScore?: number;      // Maximum spam score to include (0-100)
  includeSpam?: boolean;       // Include PRs marked as spam
  includeUnreviewed?: boolean; // Include PRs not yet analyzed
}

export const DEFAULT_SPAM_FILTER: SpamFilterOptions = {
  maxSpamScore: 50,          // Show legitimate and warning level PRs
  includeSpam: false,        // Hide definite spam
  includeUnreviewed: true,   // Show PRs not yet analyzed
};

/**
 * Fetch pull requests from database with spam filtering
 */
export async function fetchFilteredPullRequests(
  owner: string,
  repo: string,
  options: SpamFilterOptions = DEFAULT_SPAM_FILTER,
  limit: number = 100
): Promise<PullRequestWithAuthor[]> {
  try {
    // Start building the query
    let query = supabase
      .from('pull_requests')
      .select(`
        *,
        author:contributors!author_id(*),
        repository:repositories!repository_id(*)
      `)
      .eq('repository.owner', owner)
      .eq('repository.name', repo)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply spam filtering
    if (!options.includeSpam) {
      query = query.eq('is_spam', false);
    }

    // Apply spam score filtering
    if (options.maxSpamScore !== undefined && options.maxSpamScore < 100) {
      if (options.includeUnreviewed) {
        // Include PRs with no spam score OR below threshold
        query = query.or(`spam_score.is.null,spam_score.lte.${options.maxSpamScore}`);
      } else {
        // Only include PRs with spam score below threshold
        query = query.lte('spam_score', options.maxSpamScore);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching filtered PRs:', error);
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchFilteredPullRequests:', error);
    throw error;
  }
}

/**
 * Get spam statistics for a repository
 */
export async function getRepositorySpamStats(owner: string, repo: string) {
  try {
    // First get the repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      throw new Error('Repository not found');
    }

    // Get spam statistics
    const { data: stats, error: statsError } = await supabase
      .from('pull_requests')
      .select('spam_score, is_spam')
      .eq('repository_id', repoData.id)
      .not('spam_score', 'is', null);

    if (statsError) {
      throw new Error('Failed to fetch spam statistics');
    }

    if (!stats || stats.length === 0) {
      return {
        totalAnalyzed: 0,
        spamCount: 0,
        spamPercentage: 0,
        averageScore: 0,
        distribution: {
          legitimate: 0,
          warning: 0,
          likelySpam: 0,
          definiteSpam: 0,
        }
      };
    }

    const totalAnalyzed = stats.length;
    const spamCount = stats.filter(pr => pr.is_spam).length;
    const averageScore = stats.reduce((sum, pr) => sum + (pr.spam_score || 0), 0) / totalAnalyzed;

    const distribution = {
      legitimate: stats.filter(pr => (pr.spam_score || 0) <= 25).length,
      warning: stats.filter(pr => (pr.spam_score || 0) > 25 && (pr.spam_score || 0) <= 50).length,
      likelySpam: stats.filter(pr => (pr.spam_score || 0) > 50 && (pr.spam_score || 0) <= 75).length,
      definiteSpam: stats.filter(pr => (pr.spam_score || 0) > 75).length,
    };

    return {
      totalAnalyzed,
      spamCount,
      spamPercentage: (spamCount / totalAnalyzed) * 100,
      averageScore: Math.round(averageScore * 10) / 10,
      distribution,
    };
  } catch (error) {
    console.error('Error fetching spam stats:', error);
    throw error;
  }
}

/**
 * Get user's spam filter preferences
 */
export async function getUserSpamPreferences(): Promise<SpamFilterOptions> {
  // For now, return from localStorage
  // In the future, this could be stored in user profile
  const stored = localStorage.getItem('spam-filter-preferences');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_SPAM_FILTER;
    }
  }
  return DEFAULT_SPAM_FILTER;
}

/**
 * Save user's spam filter preferences
 */
export async function saveUserSpamPreferences(preferences: SpamFilterOptions): Promise<void> {
  // For now, save to localStorage
  // In the future, this could be stored in user profile
  localStorage.setItem('spam-filter-preferences', JSON.stringify(preferences));
}