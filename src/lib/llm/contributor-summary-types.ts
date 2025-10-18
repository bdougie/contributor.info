/**
 * Type definitions for AI-generated contributor activity summaries
 * Used to generate 1-2 sentence persona summaries for hover cards
 */

import type { PullRequest, RecentIssue, RecentActivity } from '../types';

/**
 * Discussion participation data for contributor summaries
 */
export interface DiscussionParticipation {
  /** Discussion title */
  title: string;

  /** Discussion category (Q&A, Ideas, General, etc.) */
  category?: string;

  /** Number of comments contributor made in this discussion */
  commentCount: number;

  /** Whether contributor created this discussion */
  isAuthor: boolean;

  /** Whether this was marked as answered (Q&A category) */
  isAnswered?: boolean;

  /** Created/participated timestamp */
  created_at: string;
}

/**
 * Enhanced issue context for better persona detection
 */
export interface IssueContext extends RecentIssue {
  /** Number of comments on the issue */
  comments_count: number;

  /** Whether contributor is the author or just commenting */
  isAuthor: boolean;

  /** Labels on the issue (bug, feature, security, etc.) */
  labels?: string[];
}

export interface ContributorActivityData {
  /** Recent pull requests by the contributor */
  recentPRs: PullRequest[];

  /** Recent issues created or participated in - enhanced with context */
  recentIssues: RecentIssue[];

  /** Recent activities across the repository */
  recentActivities: RecentActivity[];

  /** Discussion participation (created or commented on) */
  recentDiscussions?: DiscussionParticipation[];

  /** Total number of contributions (PRs + issues + reviews) */
  totalContributions: number;

  /** Primary focus area detected from activity (e.g., "authentication", "frontend") */
  primaryFocus?: string;

  /** Contribution type distribution */
  contributionTypes?: {
    prs: number;
    issues: number;
    reviews: number;
    comments: number;
    discussions?: number;
  };
}

export interface ContributorSummaryMetadata {
  /** Contributor's GitHub username */
  login: string;

  /** Repository context (optional, for better summaries) */
  repository?: {
    owner: string;
    name: string;
  };

  /** Time period for the activity summary */
  period?: string; // e.g., "this month", "last 30 days"
}
