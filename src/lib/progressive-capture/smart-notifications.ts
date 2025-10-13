import { supabase } from '../supabase';
import { ProgressiveCaptureNotifications } from './ui-notifications';
import type { HybridJob } from './hybrid-queue-manager';

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
   * Check workspace for missing data and queue capture jobs for all repositories
   */
  static async checkWorkspaceAndNotify(workspaceId: string): Promise<void> {
    const workspaceKey = `workspace:${workspaceId}`;

    if (import.meta.env?.DEV) {
      console.log('🔍 Smart detection checking workspace: %s', workspaceId);
    }

    // Don't check the same workspace repeatedly
    if (this.checkedRepositories.has(workspaceKey)) {
      if (import.meta.env?.DEV) {
        console.log('⏭️ Skipping %s - already checked', workspaceKey);
      }
      return;
    }

    // Check cooldown
    const lastNotification = this.notificationCooldown.get(workspaceKey);
    if (lastNotification && Date.now() - lastNotification < this.COOLDOWN_DURATION) {
      if (import.meta.env?.DEV) {
        console.log('⏭️ Skipping %s - in cooldown period', workspaceKey);
      }
      return;
    }

    try {
      // Get workspace repositories
      const { data: workspaceRepos, error: repoError } = await supabase
        .from('workspace_repositories')
        .select(`
          repository_id,
          repositories!inner(
            id,
            owner,
            name,
            last_updated_at
          )
        `)
        .eq('workspace_id', workspaceId);

      if (repoError || !workspaceRepos || workspaceRepos.length === 0) {
        if (import.meta.env?.DEV) {
          console.log('❌ No repositories found for workspace %s:', workspaceId, repoError?.message);
        }
        return;
      }

      if (import.meta.env?.DEV) {
        console.log('✅ Found %d repositories in workspace %s:', workspaceRepos.length, workspaceId);
      }

      let hasAnyMissingData = false;

      // Check each repository for missing data
      for (const workspaceRepo of workspaceRepos) {
        const repo = (workspaceRepo as any).repositories;
        if (!repo) continue;

        const missingData = await this.analyzeMissingData(repo.id, repo.last_updated_at);

        if (import.meta.env?.DEV) {
          console.log('📊 Missing data analysis for %s/%s:', repo.owner, repo.name, missingData);
        }

        if (missingData.length > 0) {
          hasAnyMissingData = true;
          // Auto-fix missing data for each repository in the workspace
          await this.autoFixMissingData(repo.owner, repo.name, repo.id, missingData);
        }
      }

      if (hasAnyMissingData) {
        this.notificationCooldown.set(workspaceKey, Date.now());
      } else {
        if (import.meta.env?.DEV) {
          console.log('✅ No missing data detected for workspace %s', workspaceId);
        }
      }

      this.checkedRepositories.add(workspaceKey);
    } catch (error) {
      console.error('[Smart Notifications] Error checking workspace %s:', workspaceId, error);
    }
  }

  /**
   * Check repository for missing data and show notifications if needed
   */
  static async checkRepositoryAndNotify(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;

    if (import.meta.env?.DEV) {
      console.log('🔍 Smart detection checking: %s', repoKey);
    }

    // Don't check the same repo repeatedly
    if (this.checkedRepositories.has(repoKey)) {
      if (import.meta.env?.DEV) {
        console.log('⏭️ Skipping %s - already checked', repoKey);
      }
      return;
    }

    // Check cooldown
    const lastNotification = this.notificationCooldown.get(repoKey);
    if (lastNotification && Date.now() - lastNotification < this.COOLDOWN_DURATION) {
      if (import.meta.env?.DEV) {
        console.log('⏭️ Skipping %s - in cooldown period', repoKey);
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
          console.log('❌ Repository %s not found in database:', repoKey, repoError?.message);
        }
        return;
      }

      if (import.meta.env?.DEV) {
        console.log('✅ Found %s in database:', repoKey, {
          id: repoData.id,
          last_updated_at: repoData.last_updated_at,
        });
      }

      // Check for missing data
      const missingData = await this.analyzeMissingData(repoData.id, repoData.last_updated_at);

      if (import.meta.env?.DEV) {
        console.log('📊 Missing data analysis for %s:', repoKey, missingData);
      }

      if (missingData.length > 0) {
        // Auto-fix missing data elegantly in the background
        await this.autoFixMissingData(owner, repo, repoData.id, missingData);
        this.notificationCooldown.set(repoKey, Date.now());
      } else {
        if (import.meta.env?.DEV) {
          console.log('✅ No missing data detected for %s', repoKey);
        }
      }

      this.checkedRepositories.add(repoKey);
    } catch (error) {
      console.error('[Smart Notifications] Error checking %s:', error, repoKey);
    }
  }

  /**
   * Analyze what data is missing for a repository
   */
  private static async analyzeMissingData(
    repositoryId: string,
    lastUpdatedAt: string
  ): Promise<string[]> {
    const missing: string[] = [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
        `
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
        `
        )
        .eq('repository_id', repositoryId)
        .limit(10);

      if (!commentError && commentData) {
        const prsWithoutComments = commentData.filter(
          (pr) => !pr.comments || pr.comments.length === 0
        );
        if (prsWithoutComments.length > 0) {
          missing.push('comments');
        }
      }

      // Check for missing issue comments
      const { data: issueData, error: issueError } = await supabase
        .from('issues')
        .select('id, comments_count')
        .eq('repository_id', repositoryId)
        .gt('comments_count', 0)
        .limit(5);

      if (!issueError && issueData && issueData.length > 0) {
        // Check if we have issue comments captured
        const { data: issueComments, error: issueCommentError } = await supabase
          .from('issue_comments')
          .select('id')
          .eq('repository_id', repositoryId)
          .limit(1);

        if (!issueCommentError && (!issueComments || issueComments.length === 0)) {
          missing.push('issue comments');
        }
      }

      // Check repository classification staleness (>30 days)
      const { data: repo, error: repoError } = await supabase
        .from('repositories')
        .select('size, classified_at')
        .eq('id', repositoryId)
        .maybeSingle();

      if (!repoError && repo && repo.classified_at) {
        const classificationAge = Date.now() - new Date(repo.classified_at).getTime();
        if (classificationAge > 30 * 24 * 60 * 60 * 1000) { // 30 days
          missing.push('classification');
        }
      } else if (!repoError && repo && !repo.classified_at) {
        missing.push('classification');
      }

      // Check for stale PR activity scores (PRs updated >7 days ago without recent activity updates)
      const { data: stalePRs, error: stalePRError } = await supabase
        .from('pull_requests')
        .select('id, updated_at, activity_score_updated_at')
        .eq('repository_id', repositoryId)
        .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .or(`activity_score_updated_at.is.null,activity_score_updated_at.lt.${thirtyDaysAgo.toISOString()}`)
        .limit(1);

      if (!stalePRError && stalePRs && stalePRs.length > 0) {
        missing.push('pr activity');
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
        .maybeSingle();

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
   * Automatically fix missing data in the background without user interaction
   */
  private static async autoFixMissingData(
    owner: string,
    repo: string,
    repositoryId: string,
    missingData: string[]
  ): Promise<void> {
    try {
      const repoKey = `${owner}/${repo}`;

      // Check if we recently queued jobs for this repository to prevent hot reload duplicates
      const lastQueued = this.queuedJobs.get(repoKey);
      if (lastQueued && Date.now() - lastQueued < this.QUEUE_COOLDOWN) {
        if (import.meta.env?.DEV) {
          console.log(
            `⏭️ Skipping ${repoKey} - jobs were queued recently (${Math.floor((Date.now() - lastQueued) / 1000)}s ago)`
          );
        }
        return;
      }

      const { hybridQueueManager } = await import('./hybrid-queue-manager');

      if (import.meta.env?.DEV) {
        console.log('🔧 Auto-fixing missing data for %s/%s:', owner, repo, missingData);
      }

      // Show subtle notification that we're updating data
      ProgressiveCaptureNotifications.showDataAvailable(`${owner}/${repo}`, 'updated');

      // Determine priority based on repository popularity and data freshness
      const priority = await this.calculatePriority(owner, repo, repositoryId);

      // Track that we're queuing jobs for this repository
      this.queuedJobs.set(repoKey, Date.now());

      // Queue appropriate jobs based on what's missing using hybrid routing
      const promises: Promise<HybridJob>[] = [];

      if (missingData.includes('recent PRs')) {
        if (import.meta.env?.DEV) {
          console.log(
            '⏳ Queuing recent PRs job for %s/%s with priority: %s',
            owner,
            repo,
            priority
          );
        }
        promises.push(hybridQueueManager.queueRecentDataCapture(repositoryId, `${owner}/${repo}`));
      }

      // GraphQL-first strategy: prefer GraphQL PR details for reviews + comments
      if (missingData.includes('reviews') || missingData.includes('comments')) {
        if (import.meta.env?.DEV) {
          console.log(
            '⏳ Queuing GraphQL PR details job for %s/%s with priority: %s',
            owner,
            repo,
            priority
          );
        }
        promises.push(
          hybridQueueManager.queueJob('pr-details', {
            repositoryId,
            repositoryName: `${owner}/${repo}`,
            timeRange: 7, // Recent PRs for GraphQL efficiency
            triggerSource: 'auto-fix',
            maxItems: 100,
            metadata: { priority, preferGraphQL: true },
          })
        );
      }

      // Queue issue comments separately
      if (missingData.includes('issue comments')) {
        if (import.meta.env?.DEV) {
          console.log(
            '⏳ Queuing issue comments job for %s/%s with priority: %s',
            owner,
            repo,
            priority
          );
        }
        promises.push(
          hybridQueueManager.queueJob('comments', {
            repositoryId,
            repositoryName: `${owner}/${repo}`,
            timeRange: 30, // Get more comment history
            triggerSource: 'auto-fix',
            maxItems: 200,
            metadata: { priority, captureIssueComments: true },
          })
        );
      }

      // Queue repository classification and PR activity update via historical sync
      if (missingData.includes('classification') || missingData.includes('pr activity')) {
        if (import.meta.env?.DEV) {
          console.log(
            '⏳ Queuing repository sync for classification/activity for %s/%s with priority: %s',
            owner,
            repo,
            priority
          );
        }
        promises.push(
          hybridQueueManager.queueJob('historical-pr-sync', {
            repositoryId,
            repositoryName: `${owner}/${repo}`,
            timeRange: 7, // Recent data for classification and activity
            triggerSource: 'auto-fix',
            maxItems: 50,
            metadata: { 
              priority,
              includeClassification: missingData.includes('classification'),
              includeActivityUpdate: missingData.includes('pr activity')
            },
          })
        );
      }

      // Queue historical data for file changes and commit analysis
      if (
        missingData.includes('file changes') ||
        missingData.includes('commit analysis')
      ) {
        if (import.meta.env?.DEV) {
          console.log(
            '⏳ Queuing historical data job for %s/%s with priority: %s',
            owner,
            repo,
            priority
          );
        }
        promises.push(
          hybridQueueManager.queueJob('historical-pr-sync', {
            repositoryId,
            repositoryName: `${owner}/${repo}`,
            timeRange: 30,
            triggerSource: 'auto-fix',
            maxItems: 1000,
            metadata: { priority },
          })
        );
      }

      const results = await Promise.all(promises);

      // Log in development only
      if (import.meta.env?.DEV) {
        console.log('✅ Auto-fix jobs queued for %s/%s:', owner, repo, results);
      }
    } catch (error) {
      console.warn('Could not auto-fix data for %s/%s:', error, owner, repo);
    }
  }

  /**
   * Calculate priority based on repository popularity and data freshness
   */
  private static async calculatePriority(
    owner: string,
    repo: string,
    repositoryId: string
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
      console.log('🔄 Force checking %s (bypassing cooldown and already-checked status)', repoKey);
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
        console.log('🔍 Route detection checking path: %s', path);
      }

      // Check for workspace routes first (/i/:workspaceId or /workspaces/:workspaceId)
      const workspaceMatch = path.match(/^\/(i|workspaces)\/([^\/]+)/);
      if (workspaceMatch) {
        const [, , workspaceSlug] = workspaceMatch;
        if (import.meta.env?.DEV) {
          console.log('📁 Workspace detected: %s - scheduling workspace data capture in 3 seconds', workspaceSlug);
        }
        
        // Check workspace after a short delay to let the component load
        setTimeout(() => {
          SmartDataNotifications.checkWorkspaceAndNotify(workspaceSlug);
        }, 3000);
        return;
      }

      // Match patterns like /kubernetes/kubernetes or /owner/repo/contributions
      const match = path.match(/\/([^\/]+)\/([^\/]+)(?:\/|$)/);

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
            `✅ Repository detected: ${owner}/${repo} - scheduling auto-detection in 3 seconds`
          );
        }

        // Check after a short delay to let the component load
        setTimeout(() => {
          SmartDataNotifications.checkRepositoryAndNotify(owner, repo);
        }, 3000);
      } else {
        if (import.meta.env?.DEV) {
          console.log('⏭️ Path %s does not match repository pattern or is excluded', path);
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
      console.log('🔔 Smart data detection enabled');

      // Expose for debugging
      (window as unknown as Record<string, unknown>).SmartDataNotifications =
        SmartDataNotifications;
    }
  }
}

// Initialize smart notifications
setupSmartNotifications();
