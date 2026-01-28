/**
 * Types for the community spam reporting system
 * Issue #1622: Known Spammer Community Database
 */

export type SpamCategory =
  | 'hacktoberfest'
  | 'bot_automated'
  | 'fake_contribution'
  | 'self_promotion'
  | 'low_quality'
  | 'other';

export type SpamReportStatus = 'pending' | 'verified' | 'rejected' | 'duplicate';

export type SpammerVerificationStatus = 'unverified' | 'verified' | 'appealed';

export interface SpamReport {
  id: string;
  pr_url: string;
  pr_owner: string;
  pr_repo: string;
  pr_number: number;
  contributor_github_login: string | null;
  spam_category: SpamCategory;
  description: string | null;
  reporter_id: string | null;
  reporter_ip_hash: string | null;
  spam_reporter_id: string | null;
  status: SpamReportStatus;
  verified_by: string | null;
  verified_at: string | null;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnownSpammer {
  id: string;
  github_login: string;
  github_id: number | null;
  spam_pr_count: number;
  first_reported_at: string;
  last_reported_at: string;
  verification_status: SpammerVerificationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpamReporter {
  id: string;
  user_id: string | null;
  ip_hash: string | null;
  github_login: string | null;
  total_reports: number;
  verified_reports: number;
  rejected_reports: number;
  accuracy_score: number;
  is_trusted: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
  last_report_at: string | null;
  reports_today: number;
  reports_this_hour: number;
  hour_window_start: string;
  day_window_start: string;
  created_at: string;
  updated_at: string;
}

export interface SpamReportInput {
  pr_url: string;
  spam_category: SpamCategory;
  description?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'banned' | 'hourly_limit' | 'daily_limit';
  message?: string;
  remaining_hourly?: number;
  remaining_daily?: number;
}

export interface SpamReportSubmitResult {
  success: boolean;
  report_id?: string;
  is_duplicate?: boolean;
  error?: string;
}

// Category display configuration
export const SPAM_CATEGORIES: Record<SpamCategory, { label: string; description: string }> = {
  hacktoberfest: {
    label: 'Hacktoberfest Spam',
    description:
      'Name additions, trivial README changes, meaningless contributions for Hacktoberfest',
  },
  bot_automated: {
    label: 'Bot/Automated',
    description: 'Automated PRs from bots or scripts',
  },
  fake_contribution: {
    label: 'Fake Contribution',
    description: 'PRs that pretend to fix issues but make no real changes',
  },
  self_promotion: {
    label: 'Self-Promotion',
    description: 'PRs primarily promoting personal projects, links, or services',
  },
  low_quality: {
    label: 'Low Quality',
    description: 'Very low quality contributions that add no value',
  },
  other: {
    label: 'Other',
    description: 'Other types of spam not covered above',
  },
};

// GitHub PR URL regex pattern
export const GITHUB_PR_URL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;

export function parseGitHubPRUrl(url: string): {
  owner: string;
  repo: string;
  number: number;
} | null {
  const match = url.match(GITHUB_PR_URL_PATTERN);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}
