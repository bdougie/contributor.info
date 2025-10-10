import { useState, useEffect, useRef } from 'react';
import { PullRequestActivity, PullRequest } from '@/lib/types';
import { detectBot } from '@/lib/utils/bot-detection';
import { supabaseAvatarCache } from '@/lib/supabase-avatar-cache';

// Cache interface
interface ActivityCache {
  [key: string]: {
    activities: PullRequestActivity[];
    timestamp: number;
    pullRequestsHash: string;
  };
}

// Cache duration in milliseconds (10 minutes for better performance)
const CACHE_DURATION = 10 * 60 * 1000;

// Global cache to persist across component re-mounts
const activityCache: ActivityCache = {};

function formatTimestamp(date: string): string {
  const now = new Date();
  const timestamp = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function createPullRequestsHash(pullRequests: PullRequest[]): string {
  // Create a hash of PR data to detect changes
  const prData = pullRequests.map((pr) => ({
    id: pr.id,
    updated_at: pr.updated_at,
    reviewCount: pr.reviews?.length || 0,
    commentCount: pr.comments?.length || 0,
  }));
  return JSON.stringify(prData);
}

async function processActivities(pullRequests: PullRequest[]): Promise<PullRequestActivity[]> {
  const processedActivities: PullRequestActivity[] = [];

  // Collect all PR authors with GitHub IDs for batch avatar fetching
  // NOTE: We can only use Supabase avatar cache for PR authors because they have numeric GitHub IDs.
  // Reviews and comments only provide login/avatar_url without IDs, so they can't use the cache.
  const authorsWithIds = pullRequests
    .filter((pr) => pr.user?.id)
    .map((pr) => ({
      githubId: pr.user.id,
      username: pr.user.login,
      fallbackUrl: pr.user.avatar_url,
    }));

  // Batch fetch avatars from Supabase cache for PR authors
  const avatarCache =
    authorsWithIds.length > 0 ? await supabaseAvatarCache.getAvatarUrls(authorsWithIds) : new Map();

  // Process pull requests
  pullRequests.forEach((pr) => {
    const repoUrl =
      pr.html_url?.split('/pull/')[0] ||
      `https://github.com/${pr.repository_owner}/${pr.repository_name}`;
    const owner = pr.repository_owner || repoUrl.split('github.com/')[1]?.split('/')[0] || '';
    const repo = pr.repository_name || repoUrl.split('github.com/')[1]?.split('/')[1] || '';

    // Check if user is a bot using centralized detection
    const isBot = detectBot({ githubUser: pr.user }).isBot;

    // Get cached avatar URL if available
    const cachedAvatar = avatarCache.get(pr.user.id);
    const avatarUrl = cachedAvatar?.url || pr.user.avatar_url;

    // Add PR creation activity
    processedActivities.push({
      id: `pr-${pr.id}-open`,
      type: 'opened',
      user: {
        id: pr.user.login,
        name: pr.user.login,
        avatar: avatarUrl,
        isBot: isBot,
      },
      pullRequest: {
        id: pr.id.toString(),
        number: pr.number,
        title: pr.title,
        url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
      },
      repository: {
        id: repo,
        name: repo,
        owner: owner,
        url: repoUrl,
      },
      timestamp: formatTimestamp(pr.created_at),
      createdAt: new Date(pr.created_at),
    });

    // Add merge or close status if applicable
    if (pr.merged_at) {
      processedActivities.push({
        id: `pr-${pr.id}-merge`,
        type: 'merged',
        user: {
          id: pr.user.login,
          name: pr.user.login,
          avatar: avatarUrl,
          isBot: isBot,
        },
        pullRequest: {
          id: pr.id.toString(),
          number: pr.number,
          title: pr.title,
          url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
        },
        repository: {
          id: repo,
          name: repo,
          owner: owner,
          url: repoUrl,
        },
        timestamp: formatTimestamp(pr.merged_at),
        createdAt: new Date(pr.merged_at),
      });
    } else if (pr.closed_at && !pr.merged_at) {
      processedActivities.push({
        id: `pr-${pr.id}-close`,
        type: 'closed',
        user: {
          id: pr.user.login,
          name: pr.user.login,
          avatar: avatarUrl,
          isBot: isBot,
        },
        pullRequest: {
          id: pr.id.toString(),
          number: pr.number,
          title: pr.title,
          url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
        },
        repository: {
          id: repo,
          name: repo,
          owner: owner,
          url: repoUrl,
        },
        timestamp: formatTimestamp(pr.closed_at || ''),
        createdAt: new Date(pr.closed_at || ''),
      });
    }

    // Add reviews if available
    if (pr.reviews && pr.reviews.length > 0) {
      pr.reviews.forEach((review, index) => {
        if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') {
          // Check if reviewer is a bot using centralized detection
          const reviewerIsBot = detectBot({ username: review.user.login }).isBot;

          // NOTE: Cannot use Supabase avatar cache for reviewers - no GitHub ID available

          processedActivities.push({
            id: `review-${pr.id}-${index}`,
            type: 'reviewed',
            user: {
              id: review.user.login,
              name: review.user.login,
              avatar: review.user.avatar_url,
              isBot: reviewerIsBot,
            },
            pullRequest: {
              id: pr.id.toString(),
              number: pr.number,
              title: pr.title,
              url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
            },
            repository: {
              id: repo,
              name: repo,
              owner: owner,
              url: repoUrl,
            },
            timestamp: formatTimestamp(review.submitted_at || pr.updated_at),
            createdAt: new Date(review.submitted_at || pr.updated_at),
          });
        }
      });
    }

    // Add comments if available
    if (pr.comments && pr.comments.length > 0) {
      pr.comments.forEach((comment, index) => {
        // Check if commenter is a bot using centralized detection
        const commenterIsBot = detectBot({ username: comment.user.login }).isBot;

        // NOTE: Cannot use Supabase avatar cache for commenters - no GitHub ID available

        processedActivities.push({
          id: `comment-${pr.id}-${index}`,
          type: 'commented',
          user: {
            id: comment.user.login,
            name: comment.user.login,
            avatar: comment.user.avatar_url,
            isBot: commenterIsBot,
          },
          pullRequest: {
            id: pr.id.toString(),
            number: pr.number,
            title: pr.title,
            url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
          },
          repository: {
            id: repo,
            name: repo,
            owner: owner,
            url: repoUrl,
          },
          timestamp: formatTimestamp(comment.created_at),
          createdAt: new Date(comment.created_at),
        });
      });
    }
  });

  // Sort activities by date, newest first
  return processedActivities.sort(
    (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
  );
}

export function useCachedPRActivity(pullRequests: PullRequest[]) {
  const [activities, setActivities] = useState<PullRequestActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Create a cache key based on the repository and pull requests
  const cacheKey = useRef<string>('');

  useEffect(() => {
    const processData = async () => {
      try {
        setLoading(true);

        // Generate cache key from pull requests
        const pullRequestsHash = createPullRequestsHash(pullRequests);
        const currentCacheKey = pullRequestsHash;
        cacheKey.current = currentCacheKey;

        // Check if we have cached data
        const cachedData = activityCache[currentCacheKey];
        const now = Date.now();

        if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
          // Use cached data
          setActivities(cachedData.activities);
          setError(null);
          setLoading(false);
          return;
        }

        // Process activities (now async)
        const processedActivities = await processActivities(pullRequests);

        // Cache the results
        activityCache[currentCacheKey] = {
          activities: processedActivities,
          timestamp: now,
          pullRequestsHash: pullRequestsHash,
        };

        // Clean up old cache entries (keep only last 10)
        const cacheKeys = Object.keys(activityCache);
        if (cacheKeys.length > 10) {
          const sortedKeys = cacheKeys.sort(
            (a, b) => activityCache[b].timestamp - activityCache[a].timestamp
          );
          sortedKeys.slice(10).forEach((key) => {
            delete activityCache[key];
          });
        }

        setActivities(processedActivities);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to process PR activity'));
      } finally {
        setLoading(false);
      }
    };

    processData();
  }, [pullRequests]);

  return { activities, loading, error };
}
