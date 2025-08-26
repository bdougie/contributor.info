import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type PullRequestWithAuthor = Database['public']['Tables']['pull_requests']['Row'] & {
  author: Database['public']['Tables']['contributors']['Row'];
  repository: Database['public']['Tables']['repositories']['Row'];
};

export interface SpamFilterOptions {
  maxSpamScore?: number;      // Maximum spam score to include (0-100)
  minSpamScore?: number;      // Minimum spam score to include (0-100)
  includeSpam?: boolean;       // Include PRs marked as spam (deprecated - now always true)
  includeUnreviewed?: boolean; // Include PRs not yet analyzed
}

export const DEFAULT_SPAM_FILTER: SpamFilterOptions = {
  maxSpamScore: 100,         // Show all PRs (will be sorted by score)
  includeUnreviewed: true,   // Show PRs not yet analyzed
};

/**
 * Fetch pull requests from database with spam filtering
 * This function now fetches more PRs and filters client-side for better UX
 */
export async function fetchFilteredPullRequests(
  owner: string,
  repo: string,
  options: SpamFilterOptions = DEFAULT_SPAM_FILTER,
  limit: number = 100
): Promise<PullRequestWithAuthor[]> {
  try {
    // Fetch more PRs than needed to account for filtering
    // This reduces the need for refetching when filters change
    const fetchLimit = Math.max(limit * 3, 300);
    
    const query = supabase
      .from('pull_requests')
      .select(`
        *,
        author:contributors!author_id(*),
        repository:repositories!repository_id(*)
      `)
      .eq('repository.owner', owner)
      .eq('repository.name', repo)
      .order('spam_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching PRs:', error);
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }

    if (!data) return [];

    // Apply client-side filtering
    const filtered = data.filter(pr => {
      // Treat both null and 0 spam scores as unanalyzed
      const isUnanalyzed = pr.spam_score === null || pr.spam_score === 0;
      
      if (isUnanalyzed) {
        return options.includeUnreviewed !== false;
      }

      // Apply spam score filter
      if (options.maxSpamScore !== undefined && options.maxSpamScore < 100) {
        return pr.spam_score <= options.maxSpamScore;
      }

      return true;
    });

    // Return only the requested number of results
    return filtered.slice(0, limit);
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
      .maybeSingle();

    if (repoError || !repoData) {
      throw new Error('Repository not found');
    }

    // Get spam statistics - include all PRs to see what percentage have been analyzed
    const { data: allPRs, error: allError } = await supabase
      .from('pull_requests')
      .select('spam_score, is_spam')
      .eq('repository_id', repoData.id);

    if (allError) {
      throw new Error('Failed to fetch PR statistics');
    }

    if (!allPRs || allPRs.length === 0) {
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

    // Filter only analyzed PRs for statistics (exclude both null and 0 scores)
    const stats = allPRs.filter(pr => pr.spam_score !== null && pr.spam_score !== 0);

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