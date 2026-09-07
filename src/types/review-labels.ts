export type ReviewDecision = 'good' | 'bad' | 'skip';
export const REVIEW_CONSENT_VERSION = '2026-09-07-v1';
export const REVIEW_CONSENT_TEXT =
  'Your labels can be used to train a model that reflects how you review code. Saving Good, Bad, or Missed opts you in. Joining or skipping does not.';

export interface ReviewHunk {
  id: string;
  path: string;
  language: 'Go' | 'Rust';
  startLine: number;
  diff: string;
}
export interface ReviewEvidence {
  author: string;
  body: string;
  time: string;
  url: string;
}
export interface ReviewComment {
  id: string;
  author: string;
  authorId: string;
  isBot: boolean;
  body: string;
  url: string;
  hunkId: string;
  commitId: string;
  originalLine: number | null;
  replies: ReviewEvidence[];
  resolved: boolean | null;
  outdated: boolean | null;
  laterApprovals: ReviewEvidence[];
}
export interface ReviewPR {
  id: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  closedAt: string;
  headSha: string;
  participation: string;
  hunks: ReviewHunk[];
  comments: ReviewComment[];
  unavailableFiles: string[];
}
export interface LabelRecord {
  id: string;
  schema_version: 1;
  reviewer_login: string;
  reviewer_github_id: string;
  repo: string;
  pr_number: number;
  pr_id: string;
  file_path: string;
  hunk: string;
  hunk_id: string;
  comment: ReviewComment | null;
  label: ReviewDecision | 'missed';
  note: string | null;
  timestamp: string;
  consent_id: string | null;
  consent_version: string | null;
  campaign_id: string;
}
export interface ReviewCampaign {
  id: string;
  workspace_id: string;
  repository_ids: string[];
  cutoff: string;
}
export interface ReviewEnrollment {
  id: string;
  campaign_id: string;
  reviewer_login: string;
  consent_at: string | null;
  scan_repo: number;
  scan_page: number;
  scan_done: boolean;
}
export interface ReviewInvite {
  id: string;
  campaign_id: string;
  reviewer_login: string;
  created_at: string;
  expires_at: string;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  revoked_at: string | null;
}
export interface ReviewWorkspace {
  id: string;
  name: string;
  canManage: boolean;
  repositories: { id: string; full_name: string; is_private: boolean }[];
  campaigns: ReviewCampaign[];
  invites: ReviewInvite[];
}
export interface ReviewHome {
  workspaces: ReviewWorkspace[];
  enrollments: ReviewEnrollment[];
}
export interface ReviewQueue {
  enrollment: ReviewEnrollment;
  prs: ReviewPR[];
  labels: LabelRecord[];
}
export interface ReviewInvitePreview {
  workspaceName: string;
  reviewerLogin: string;
  expiresAt: string;
  accepted: boolean;
}

export function reviewInvitePath(token: string): string {
  return `/review-labels/${encodeURIComponent(token)}/invite`;
}
