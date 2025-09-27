import type { PullRequestActivity } from '@/lib/types';
import type { Database } from '@/types/database';
import { getPRActivityType } from '@/lib/utils/performance-helpers';

type DatabasePR = Database['public']['Tables']['pull_requests']['Row'] & {
  author: Database['public']['Tables']['contributors']['Row'];
  repository: Database['public']['Tables']['repositories']['Row'];
};

/**
 * Convert database PR data to PullRequestActivity format for use with ActivityItem components
 */
export function convertDatabasePRToActivity(pr: DatabasePR): PullRequestActivity | null {
  // Skip PRs with missing required data
  if (!pr.author || !pr.repository) {
    return null;
  }

  return {
    id: pr.id,
    type: getPRActivityType(pr) as 'opened' | 'closed' | 'merged',
    user: {
      id: String(pr.author.github_id),
      name: pr.author.username,
      avatar: pr.author.avatar_url,
      isBot: pr.author.is_bot,
    },
    pullRequest: {
      id: pr.github_id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      draft: pr.draft,
      merged: pr.merged,
      mergeable: null, // Not available in our DB schema
      url: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commits: pr.commits,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      // Add spam detection fields
      spamScore: pr.spam_score,
      isSpam: pr.is_spam,
      spamFlags: pr.spam_flags as
        | {
            suspicious_title?: boolean;
            suspicious_body?: boolean;
            suspicious_user?: boolean;
            unusual_activity?: boolean;
            [key: string]: boolean | undefined;
          }
        | undefined,
    },
    repository: {
      id: String(pr.repository.github_id),
      name: pr.repository.name,
      fullName: pr.repository.full_name,
      owner: pr.repository.owner,
      private: pr.repository.is_private,
      url: `https://github.com/${pr.repository.full_name}`,
    },
    timestamp: pr.created_at,
    // Additional metadata for spam detection
    metadata: {
      spamScore: pr.spam_score,
      isSpam: pr.is_spam,
      spamDetectedAt: pr.spam_detected_at,
    },
  };
}

/**
 * Convert multiple database PRs to activity format
 */
export function convertDatabasePRsToActivities(prs: DatabasePR[]): PullRequestActivity[] {
  return prs
    .map(convertDatabasePRToActivity)
    .filter((activity): activity is PullRequestActivity => activity !== null);
}

/**
 * Sort activities by timestamp (most recent first)
 */
export function sortActivitiesByTimestamp(
  activities: PullRequestActivity[]
): PullRequestActivity[] {
  return activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
