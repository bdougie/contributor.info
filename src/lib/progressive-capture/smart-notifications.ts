import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';

/**
 * Smart notification system that detects missing data and offers fixes
 */
export class SmartDataNotifications {
  private static checkedRepositories = new Set<string>();
  private static notificationCooldown = new Map<string, number>();
  private static queuedJobs = new Map<string, number>(); // Track when jobs were last queued
  private static readonly COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes
  private static readonly QUEUE_COOLDOWN = 5 * 60 * 1000; // 5 minutes between queue jobs

  /**
   * Check repository for missing data and show notifications if needed
   */
  static async checkRepositoryAndNotify(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;

    if (import.meta.env?.DEV) {
      console.log(`🔍 Smart detection checking: ${repoKey}`);
    }

    // Don't check the same repo repeatedly
    if (this.checkedRepositories.has(repoKey)) {
      if (import.meta.env?.DEV) {
        console.log(`⏭️ Skipping ${repoKey} - already checked`);
      }
      return;
    }

    // Check cooldown
    const lastNotification = this.notificationCooldown.get(repoKey);
    if (lastNotification && Date.now() - lastNotification < this.COOLDOWN_DURATION) {
      if (import.meta.env?.DEV) {
        console.log(`⏭️ Skipping ${repoKey} - in cooldown period`);
      }
      return;
    }

    try {
      // Find repository in database
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select('id, last_updated_at')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      if (repoError || !repoData) {
        if (import.meta.env?.DEV) {
          console.log(`❌ Repository ${repoKey} not found in _database:`, repoError?.message);
        }
        return;
      }

      if (import.meta.env?.DEV) {
        console.log(`✅ Found ${repoKey} in _database:`, {
          id: repoData.id,
          last_updated_at: repoData.last_updated_at,
        });
      }

      // Check for missing data
      const missingData = await this.analyzeMissingData(repoData.id, repoData.last_updated_at);

      if (import.meta.env?.DEV) {
        console.log(`📊 Missing _data analysis for ${repoKey}:`, missingData);
      }

      if (missingData.length > 0) {
        // Auto-fix missing data elegantly in the background
        await this.autoFixMissingData(owner, repo, repoData.id, missingData);
        this.notificationCooldown.set(repoKey, Date.now());
      } else {
        if (import.meta.env?.DEV) {
          console.log(`✅ No missing _data detected for ${repoKey}`);
        }
      }

      this.checkedRepositories.add(repoKey);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  /**
   * Analyze what data is missing for a repository
   */
  private static async analyzeMissingData(
    repositoryId: string,
    lastUpdatedAt: string,
  ): Promise<string[]> {
    const missing: string[] = [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const lastUpdate = new Date(lastUpdatedAt);

    try {
      // Check if data is stale (24hrs for popular repos, 3 days for others)
      if (lastUpdate < twentyFourHoursAgo) {
        missing.push('recent PRs');
      } else if (lastUpdate < threeDaysAgo) {
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

      // Check for missing reviews by joining with pull_requests
      const { data: reviewData, error: reviewError } = await supabase
        .from('pull_requests')
        .select(
          `
          id,
          reviews(id)
        `,
        )
        .eq('repository_id', repositoryId)
        .limit(10);

      if (!reviewError && reviewData) {
        const prsWithoutReviews = reviewData.filter((pr) => !pr.reviews || pr.reviews.length === 0);
        if (prsWithoutReviews.length > 0) {
          missing.push('reviews');
        }
      }

      // Check for missing comments by joining with pull_requests
      const { data: commentData, error: commentError } = await supabase
        .from('pull_requests')
        .select(
          `
          id,
          comments(id)
        `,
        )
        .eq('repository_id', repositoryId)
        .limit(10);

      if (!commentError && commentData) {
        const prsWithoutComments = commentData.filter(
          (pr) => !pr.comments || pr.comments.length === 0,
        );
        if (prsWithoutComments.length > 0) {
          missing.push('comments');
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }

    return missing;
  }

  /**
   * Show notification when new data becomes available
   */
  static async notifyDataUpdated(repositoryId: string, _dataTypes: string[]): Promise<void> {
    try {
      // Get repository info
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !repoData) {
        return;
      }

      const repoName = `${repoData.owner}/${repoData.name}`;

      for (const dataType of _dataTypes) {
        ProgressiveCaptureNotifications.showDataAvailable(repoName, _dataType);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  /**
   * Automatically fix missing data in the background without user interaction
   */
  private static async autoFixMissingData(
    owner: string,
    repo: string,
    repositoryId: string,
    missingData: string[],
  ): Promise<void> {
    try {
      const repoKey = `${owner}/${repo}`;

      // Check if we recently queued jobs for this repository to prevent hot reload duplicates
      const lastQueued = this.queuedJobs.get(repoKey);
      if (lastQueued && Date.now() - lastQueued < this.QUEUE_COOLDOWN) {
        if (import.meta.env?.DEV) {
          console.log(
            `⏭️ Skipping ${repoKey} - jobs were queued recently (${Math.floor((Date.now() - lastQueued) / 1000)}s ago)`,
          );
        }
        return;
      }

      const { hybridQueueManager } = await import('./hybrid-queue-manager');

      if (import.meta.env?.DEV) {
        console.log(`🔧 Auto-fixing missing _data for ${owner}/${repo}:`, missingData);
      }

      // Show subtle notification that we're updating data
      ProgressiveCaptureNotifications.showDataAvailable(`${owner}/${repo}`, 'updated');

      // Determine priority based on repository popularity and data freshness
      const priority = await this.calculatePriority(owner, repo, repositoryId);

      // Track that we're queuing jobs for this repository
      this.queuedJobs.set(repoKey, Date.now());

      // Queue appropriate jobs based on what's missing using hybrid routing
      const promises: Promise<any>[] = [];

      if (missingData.includes('recent PRs')) {
        if (import.meta.env?.DEV) {
          console.log(`⏳ Queuing recent PRs job for ${owner}/${repo} with priority: ${priority}`);
        }
        promises.push(hybridQueueManager.queueRecentDataCapture(repositoryId, `${owner}/${repo}`));
      }

      if (
        missingData.includes('file changes') ||
        missingData.includes('reviews') ||
        missingData.includes('comments') ||
        missingData.includes('commit analysis')
      ) {
        if (import.meta.env?.DEV) {
          console.log(
            `⏳ Queuing historical _data job for ${owner}/${repo} with priority: ${priority}`,
          );
        }
        // Use queueJob directly to pass auto-fix reason
        promises.push(
          hybridQueueManager.queueJob('historical-pr-sync', {
            repositoryId,
            repositoryName: `${owner}/${repo}`,
            timeRange: 30,
            triggerSource: 'auto-fix', // Special reason for lenient throttling
            maxItems: 1000,
            metadata: { priority },
          }),
        );
      }

      const results = await Promise.all(promises);

      // Log in development only
      if (import.meta.env?.DEV) {
        console.log(`✅ Auto-fix jobs queued for ${owner}/${repo}:`, results);
      }
    } catch (error) {
      console.warn(`Could not auto-fix _data for ${owner}/${repo}:`, error);
    }
  }

  /**
   * Calculate priority based on repository popularity and data freshness
   */
  private static async calculatePriority(
    owner: string,
    repo: string,
    repositoryId: string,
  ): Promise<'critical' | 'high' | 'medium' | 'low'> {
    try {
      // Popular repositories from example-repos.tsx get higher priority
      const popularRepos = [
        'continuedev/continue',
        'kubernetes/kubernetes',
        'facebook/react',
        'etcd-io/etcd',
        'vitejs/vite',
      ];

      const repoName = `${owner}/${repo}`;
      const isPopular = popularRepos.includes(repoName);

      // Check data freshness - get latest PR update
      const { data: latestPR } = await supabase
        .from('pull_requests')
        .select('updated_at')
        .eq('repository_id', repositoryId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const hasRecentData = latestPR && new Date(latestPR.updated_at) > twentyFourHoursAgo;

      // Priority logic based on popularity and freshness
      if (isPopular && !hasRecentData) {
        return 'critical'; // Popular repo with stale data
      } else if (isPopular && hasRecentData) {
        return 'low'; // Popular repo with recent data
      } else if (!isPopular && !hasRecentData) {
        return 'high'; // Regular repo with stale data
      } else {
        return 'medium'; // Regular repo with recent data
      }
    } catch (error) {
      console.warn('Error calculating priority, defaulting to medium:', error);
      return 'medium';
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
    this.queuedJobs.clear();
  }

  /**
   * Force check a repository (bypass cooldown)
   */
  static async forceCheck(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;
    this.checkedRepositories.delete(repoKey);
    this.notificationCooldown.delete(repoKey);

    if (import.meta.env?.DEV) {
      console.log(`🔄 Force checking ${repoKey} (bypassing cooldown and already-checked status)`);
    }

    await this.checkRepositoryAndNotify(owner, repo);
  }

  /**
   * Get debug info about current state
   */
  static getDebugInfo(): { checkedRepositories: string[]; cooldowns: Record<string, number> } {
    const cooldowns: Record<string, number> = {};
    this.notificationCooldown.forEach((timestamp, repo) => {
      const minutesAgo = Math.floor((Date.now() - timestamp) / 1000 / 60);
      cooldowns[repo] = minutesAgo;
    });

    return {
      checkedRepositories: Array.from(this.checkedRepositories),
      cooldowns,
    };
  }
}

// Auto-check repositories when they're viewed
export function setupSmartNotifications(): void {
  // Listen for route changes to check repositories
  if (typeof window !== 'undefined') {
    const checkCurrentRoute = () => {
      const path = window.location.pathname;

      if (import.meta.env?.DEV) {
        console.log(`🔍 Route detection checking path: ${path}`);
      }

      // Check for workspace routes first
      const workspaceMatch = path.match(/^\/i\/([^/]+)/);
      if (workspaceMatch) {
        const [, workspaceSlug] = workspaceMatch;
        if (import.meta.env?.DEV) {
          console.log(`📁 Workspace detected: ${workspaceSlug} - skipping repository detection`);
        }
        // Don't try to detect repositories for workspace routes
        return;
      }

      // Match patterns like /kubernetes/kubernetes or /owner/repo/contributions
      const match = path.match(/\/([^/]+)\/([^/]+)(?:\/|$)/);

      // Exclude non-repository routes using Set for better performance
      const EXCLUDED_ROUTE_PREFIXES = new Set([
        'login',
        'debug',
        'admin',
        'dev',
        'api',
        'auth',
        'oauth',
        'settings',
        'privacy',
        'terms',
        'changelog',
        'docs',
        'widgets',
        'trending',
      ]);

      if (match && !EXCLUDED_ROUTE_PREFIXES.has(match[1])) {
        const [, owner, repo] = match;

        if (import.meta.env?.DEV) {
          console.log(
            `✅ Repository detected: ${owner}/${repo} - scheduling auto-detection in 3 seconds`,
          );
        }

        // Check after a short delay to let the component load
        setTimeout(() => {
          SmartDataNotifications.checkRepositoryAndNotify(owner, repo);
        }, 3000);
      } else {
        if (import.meta.env?.DEV) {
          console.log(`⏭️ Path ${path} doesn't match repository pattern or is excluded`);
        }
      }
    };

    // Check on initial load
    checkCurrentRoute();

    // Check on navigation
    window.addEventListener('popstate', checkCurrentRoute);

    // Listen for pushstate/replacestate (React Router navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(checkCurrentRoute, 100);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkCurrentRoute, 100);
    };

    if (import.meta.env?.DEV) {
      console.log('🔔 Smart _data detection enabled');

      // Expose for debugging
      (window as any).SmartDataNotifications = SmartDataNotifications;
    }
  }
}

// Initialize smart notifications
setupSmartNotifications();
