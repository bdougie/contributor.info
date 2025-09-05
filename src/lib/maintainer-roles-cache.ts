import { supabase } from './supabase';
import type { ContributorRole } from '@/hooks/useContributorRoles';

interface MaintainerRoleCache {
  [repoKey: string]: {
    roles: Map<string, ContributorRole>;
    lastFetched: number;
    loading: boolean;
  };
}

class MaintainerRolesCacheService {
  private cache: MaintainerRoleCache = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  private isStale(lastFetched: number): boolean {
    return Date.now() - lastFetched > this.CACHE_DURATION;
  }

  /**
   * Get maintainer roles for a repository
   * Returns cached data immediately if available, otherwise fetches from database
   */
  async getRoles(owner: string, repo: string): Promise<Map<string, ContributorRole>> {
    const repoKey = this.getRepoKey(owner, repo);
    const cached = this.cache[repoKey];

    // Return cached data if fresh
    if (cached && !this.isStale(cached.lastFetched)) {
      return cached.roles;
    }

    // If already loading, wait for it to complete
    if (cached?.loading) {
      return this.waitForLoad(repoKey);
    }

    // Start loading fresh data
    return this.fetchAndCache(owner, repo);
  }

  /**
   * Get a specific contributor's role from cache
   */
  getContributorRole(owner: string, repo: string, username: string): ContributorRole | null {
    const repoKey = this.getRepoKey(owner, repo);
    const cached = this.cache[repoKey];

    if (!cached || this.isStale(cached.lastFetched)) {
      return null;
    }

    return cached.roles.get(username) || null;
  }

  /**
   * Check if a user is a maintainer (owner or maintainer role)
   */
  isMaintainer(owner: string, repo: string, username: string): boolean {
    const role = this.getContributorRole(owner, repo, username);
    return role?.role === 'maintainer' || role?.role === 'owner';
  }

  /**
   * Preload roles for a repository (fire and forget)
   */
  preloadRoles(owner: string, repo: string): void {
    const repoKey = this.getRepoKey(owner, repo);
    const cached = this.cache[repoKey];

    // Only preload if not already cached or loading
    if (!cached || (this.isStale(cached.lastFetched) && !cached.loading)) {
      this.fetchAndCache(owner, repo).catch((error) => {
        console.warn('Failed to preload maintainer roles:', error);
      });
    }
  }

  /**
   * Clear cache for a specific repository
   */
  clearCache(owner: string, repo: string): void {
    const repoKey = this.getRepoKey(owner, repo);
    delete this.cache[repoKey];
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.cache = {};
  }

  private async fetchAndCache(owner: string, repo: string): Promise<Map<string, ContributorRole>> {
    const repoKey = this.getRepoKey(owner, repo);

    // Mark as loading
    this.cache[repoKey] = {
      roles: new Map(),
      lastFetched: 0,
      loading: true,
    };

    try {
      const { data, error } = await supabase
        .from('contributor_roles')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .gte('confidence_score', 0.5) // Only fetch roles with decent confidence
        .order('confidence_score', { ascending: false });

      if (error) throw error;

      // Convert to Map for fast lookups
      const rolesMap = new Map<string, ContributorRole>();
      (data || []).forEach((role) => {
        rolesMap.set(role.user_id, role);
      });

      // Update cache
      this.cache[repoKey] = {
        roles: rolesMap,
        lastFetched: Date.now(),
        loading: false,
      };

      return rolesMap;
    } catch (error) {
      // Clear loading state on error
      delete this.cache[repoKey];
      console.error('Failed to fetch maintainer roles:', error);
      return new Map();
    }
  }

  private async waitForLoad(repoKey: string): Promise<Map<string, ContributorRole>> {
    return new Promise((resolve) => {
      const checkLoading = () => {
        const cached = this.cache[repoKey];
        if (!cached?.loading) {
          resolve(cached?.roles || new Map());
        } else {
          setTimeout(checkLoading, 100);
        }
      };
      checkLoading();
    });
  }
}

// Export singleton instance
export const maintainerRolesCache = new MaintainerRolesCacheService();
