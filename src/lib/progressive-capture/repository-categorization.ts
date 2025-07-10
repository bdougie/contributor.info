import { supabase } from '../supabase';
import { hybridRolloutManager } from './rollout-manager';

export interface RepositoryCategoryStats {
  category: string;
  count: number;
  total_star_count: number;
  total_contributor_count: number;
  total_pr_count: number;
  average_activity_score: number;
}

export interface RepositoryCategorizer {
  categorizeAll(): Promise<void>;
  categorizeRepository(repositoryId: string): Promise<string | null>;
  getCategoryStats(): Promise<RepositoryCategoryStats[]>;
  getRepositoriesByCategory(category: string): Promise<any[]>;
  markAsTestRepository(repositoryId: string): Promise<boolean>;
  unmarkAsTestRepository(repositoryId: string): Promise<boolean>;
}

/**
 * Repository Categorization Manager
 * 
 * Handles automatic categorization of repositories based on:
 * - Star count
 * - Contributor count  
 * - PR count
 * - Activity patterns
 * 
 * Categories: test, small, medium, large, enterprise
 */
export class RepositoryCategorizationManager implements RepositoryCategorizer {
  
  /**
   * Categorize all repositories in the database
   */
  async categorizeAll(): Promise<void> {
    try {
      console.log('[RepositoryCategorization] Starting bulk categorization...');
      
      // Get all repositories
      const { data: repositories, error } = await supabase
        .from('repositories')
        .select('id, name, owner');

      if (error) {
        console.error('[RepositoryCategorization] Error fetching repositories:', error);
        return;
      }

      if (!repositories || repositories.length === 0) {
        console.log('[RepositoryCategorization] No repositories found for categorization');
        return;
      }

      console.log(`[RepositoryCategorization] Categorizing ${repositories.length} repositories...`);

      // Categorize each repository
      for (const repo of repositories) {
        try {
          const category = await this.categorizeRepository(repo.id);
          console.log(`[RepositoryCategorization] ${repo.owner}/${repo.name} → ${category}`);
        } catch (error) {
          console.error(`[RepositoryCategorization] Error categorizing ${repo.owner}/${repo.name}:`, error);
        }
      }

      console.log('[RepositoryCategorization] Bulk categorization completed');
    } catch (error) {
      console.error('[RepositoryCategorization] Exception during bulk categorization:', error);
    }
  }

  /**
   * Categorize a single repository
   */
  async categorizeRepository(repositoryId: string): Promise<string | null> {
    try {
      const category = await hybridRolloutManager.categorizeRepository(repositoryId);
      return category?.category || null;
    } catch (error) {
      console.error(`[RepositoryCategorization] Error categorizing repository ${repositoryId}:`, error);
      return null;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<RepositoryCategoryStats[]> {
    try {
      const { data, error } = await supabase
        .from('repository_categories')
        .select(`
          category,
          star_count,
          contributor_count,
          pr_count,
          monthly_activity_score
        `);

      if (error) {
        console.error('[RepositoryCategorization] Error fetching category stats:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by category and calculate stats
      const categoryMap = new Map<string, {
        count: number;
        total_star_count: number;
        total_contributor_count: number;
        total_pr_count: number;
        total_activity_score: number;
      }>();

      for (const repo of data) {
        const category = repo.category;
        const existing = categoryMap.get(category) || {
          count: 0,
          total_star_count: 0,
          total_contributor_count: 0,
          total_pr_count: 0,
          total_activity_score: 0
        };

        existing.count += 1;
        existing.total_star_count += repo.star_count || 0;
        existing.total_contributor_count += repo.contributor_count || 0;
        existing.total_pr_count += repo.pr_count || 0;
        existing.total_activity_score += repo.monthly_activity_score || 0;

        categoryMap.set(category, existing);
      }

      // Convert to array with averages
      const stats: RepositoryCategoryStats[] = [];
      for (const [category, totals] of categoryMap) {
        stats.push({
          category,
          count: totals.count,
          total_star_count: totals.total_star_count,
          total_contributor_count: totals.total_contributor_count,
          total_pr_count: totals.total_pr_count,
          average_activity_score: totals.count > 0 ? totals.total_activity_score / totals.count : 0
        });
      }

      // Sort by count descending
      stats.sort((a, b) => b.count - a.count);

      return stats;
    } catch (error) {
      console.error('[RepositoryCategorization] Exception getting category stats:', error);
      return [];
    }
  }

  /**
   * Get repositories by category
   */
  async getRepositoriesByCategory(category: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('repository_categories')
        .select(`
          *,
          repositories (
            id,
            name,
            owner,
            description,
            stargazers_count,
            contributors_count,
            updated_at
          )
        `)
        .eq('category', category)
        .order('priority_level', { ascending: false });

      if (error) {
        console.error(`[RepositoryCategorization] Error fetching repositories for category ${category}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`[RepositoryCategorization] Exception getting repositories for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Mark a repository as a test repository
   */
  async markAsTestRepository(repositoryId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('repository_categories')
        .update({
          is_test_repository: true,
          category: 'test',
          priority_level: 100,
          updated_at: new Date().toISOString()
        })
        .eq('repository_id', repositoryId);

      if (error) {
        console.error(`[RepositoryCategorization] Error marking repository ${repositoryId} as test:`, error);
        return false;
      }

      console.log(`[RepositoryCategorization] Marked repository ${repositoryId} as test repository`);
      return true;
    } catch (error) {
      console.error(`[RepositoryCategorization] Exception marking repository ${repositoryId} as test:`, error);
      return false;
    }
  }

  /**
   * Unmark a repository as a test repository
   */
  async unmarkAsTestRepository(repositoryId: string): Promise<boolean> {
    try {
      // Re-categorize based on actual metrics
      const category = await this.categorizeRepository(repositoryId);
      
      if (!category) {
        console.error(`[RepositoryCategorization] Could not re-categorize repository ${repositoryId}`);
        return false;
      }

      const { error } = await supabase
        .from('repository_categories')
        .update({
          is_test_repository: false,
          updated_at: new Date().toISOString()
        })
        .eq('repository_id', repositoryId);

      if (error) {
        console.error(`[RepositoryCategorization] Error unmarking repository ${repositoryId} as test:`, error);
        return false;
      }

      console.log(`[RepositoryCategorization] Unmarked repository ${repositoryId} as test repository`);
      return true;
    } catch (error) {
      console.error(`[RepositoryCategorization] Exception unmarking repository ${repositoryId} as test:`, error);
      return false;
    }
  }

  /**
   * Get test repositories for rollout
   */
  async getTestRepositories(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('repository_categories')
        .select(`
          *,
          repositories (
            id,
            name,
            owner,
            description,
            stargazers_count,
            contributors_count,
            updated_at
          )
        `)
        .eq('is_test_repository', true)
        .order('priority_level', { ascending: false });

      if (error) {
        console.error('[RepositoryCategorization] Error fetching test repositories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[RepositoryCategorization] Exception getting test repositories:', error);
      return [];
    }
  }

  /**
   * Get rollout-ready repositories by priority
   */
  async getRolloutReadyRepositories(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('repository_categories')
        .select(`
          *,
          repositories (
            id,
            name,
            owner,
            description,
            stargazers_count,
            contributors_count,
            updated_at
          )
        `)
        .order('priority_level', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[RepositoryCategorization] Error fetching rollout-ready repositories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[RepositoryCategorization] Exception getting rollout-ready repositories:', error);
      return [];
    }
  }
}

// Export singleton instance
export const repositoryCategorizer = new RepositoryCategorizationManager();