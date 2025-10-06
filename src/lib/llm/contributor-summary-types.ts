/**
 * Type definitions for AI-generated contributor activity summaries
 * Used to generate 1-2 sentence persona summaries for hover cards
 */

import type { PullRequest, RecentIssue, RecentActivity } from '../types';

export interface ContributorActivityData {
  /** Recent pull requests by the contributor */
  recentPRs: PullRequest[];

  /** Recent issues created or participated in */
  recentIssues: RecentIssue[];

  /** Recent activities across the repository */
  recentActivities: RecentActivity[];

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
