import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';

/**
 * Smart notification system that detects missing data and offers fixes
 */
export class SmartDataNotifications {
  private static checkedRepositories = new Set<string>();
  private static notificationCooldown = new Map<string, number>();
  private static readonly COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Check repository for missing data and show notifications if needed
   */
  static async checkRepositoryAndNotify(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;
    
    // Don't check the same repo repeatedly
    if (this.checkedRepositories.has(repoKey)) {
      return;
    }

    // Check cooldown
    const lastNotification = this.notificationCooldown.get(repoKey);
    if (lastNotification && Date.now() - lastNotification < this.COOLDOWN_DURATION) {
      return;
    }

    try {
      // Find repository in database
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select('id, last_updated_at')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (repoError || !repoData) {
        console.log(`[Smart Notifications] Repository ${repoKey} not found in database`);
        return;
      }

      // Check for missing data
      const missingData = await this.analyzeMissingData(repoData.id, repoData.last_updated_at);
      
      if (missingData.length > 0) {
        ProgressiveCaptureNotifications.showMissingDataNotification(repoKey, missingData);
        this.notificationCooldown.set(repoKey, Date.now());
      }

      this.checkedRepositories.add(repoKey);
      
    } catch (error) {
      console.error(`[Smart Notifications] Error checking ${repoKey}:`, error);
    }
  }

  /**
   * Analyze what data is missing for a repository
   */
  private static async analyzeMissingData(repositoryId: string, lastUpdatedAt: string): Promise<string[]> {
    const missing: string[] = [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const lastUpdate = new Date(lastUpdatedAt);

    try {
      // Check if data is stale
      if (lastUpdate < threeDaysAgo) {
        missing.push('recent PRs');
      }

      // Check for missing file changes
      const { data: prsWithoutChanges, error: prError } = await supabase
        .from('pull_requests')
        .select('id')
        .eq('repository_id', repositoryId)
        .eq('additions', 0)
        .eq('deletions', 0)
        .limit(1);

      if (!prError && prsWithoutChanges && prsWithoutChanges.length > 0) {
        missing.push('file changes');
      }

      // Check for missing commit analysis
      const { data: unanalyzedCommits, error: commitError } = await supabase
        .from('commits')
        .select('id')
        .eq('repository_id', repositoryId)
        .is('is_direct_commit', null)
        .limit(1);

      if (!commitError && unanalyzedCommits && unanalyzedCommits.length > 0) {
        missing.push('commit analysis');
      }

      // Check for missing reviews
      const { count: reviewCount, error: reviewError } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('pull_request_id', 
          supabase.from('pull_requests').select('id').eq('repository_id', repositoryId).limit(1)
        );

      if (!reviewError && reviewCount === 0) {
        missing.push('reviews');
      }

    } catch (error) {
      console.error('[Smart Notifications] Error analyzing missing data:', error);
    }

    return missing;
  }

  /**
   * Show notification when new data becomes available
   */
  static async notifyDataUpdated(repositoryId: string, dataTypes: string[]): Promise<void> {
    try {
      // Get repository info
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (error || !repoData) {
        return;
      }

      const repoName = `${repoData.owner}/${repoData.name}`;
      
      for (const dataType of dataTypes) {
        ProgressiveCaptureNotifications.showDataAvailable(repoName, dataType);
      }

    } catch (error) {
      console.error('[Smart Notifications] Error notifying data update:', error);
    }
  }

  /**
   * Show rate limit warning when approaching limits
   */
  static checkRateLimitAndNotify(remaining: number, limit: number): void {
    const percentage = (remaining / limit) * 100;
    
    if (percentage < 20 && percentage > 15) {
      // Show warning when under 20% remaining
      ProgressiveCaptureNotifications.showRateLimitWarning();
    }
  }

  /**
   * Reset cooldowns and checks (for testing)
   */
  static reset(): void {
    this.checkedRepositories.clear();
    this.notificationCooldown.clear();
  }

  /**
   * Force check a repository (bypass cooldown)
   */
  static async forceCheck(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;
    this.checkedRepositories.delete(repoKey);
    this.notificationCooldown.delete(repoKey);
    await this.checkRepositoryAndNotify(owner, repo);
  }
}

// Auto-check repositories when they're viewed
export function setupSmartNotifications(): void {
  // Listen for route changes to check repositories
  if (typeof window !== 'undefined') {
    const checkCurrentRepository = () => {
      const path = window.location.pathname;
      const match = path.match(/\/repo\/([^\/]+)\/([^\/]+)/);
      
      if (match) {
        const [, owner, repo] = match;
        // Check after a short delay to let the component load
        setTimeout(() => {
          SmartDataNotifications.checkRepositoryAndNotify(owner, repo);
        }, 2000);
      }
    };

    // Check on initial load
    checkCurrentRepository();

    // Check on navigation
    window.addEventListener('popstate', checkCurrentRepository);
    
    // Listen for pushstate/replacestate (React Router navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(checkCurrentRepository, 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkCurrentRepository, 100);
    };

    console.log('🔔 Smart notifications enabled - will detect missing data automatically');
  }
}

// Initialize smart notifications
setupSmartNotifications();