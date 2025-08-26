// GitHub API response types for Inngest functions

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: {
    id: number;
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merged_by?: {
    id: number;
    login: string;
    avatar_url: string;
    type: string;
  } | null;
  draft: boolean;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  review_comments: number;
  comments: number;
  mergeable_state: string;
  merged: boolean;
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
}

export interface GitHubReview {
  id: number;
  user: {
    id: number;
    login: string;
  } | null;
  state: string;
  body: string;
  submitted_at: string;
  commit_id: string;
}

export interface GitHubComment {
  id: number;
  user: {
    id: number;
    login: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: number;
  path?: string;
  line?: number;
  commit_id?: string;
}

export interface DatabaseComment {
  github_id: string;
  repository_id: string;
  pull_request_id: string;
  commenter_id?: string;
  body: string;
  created_at: string;
  updated_at: string;
  comment_type: 'issue_comment' | 'review_comment';
  in_reply_to_id?: string;
  position?: number;
  original_position?: number;
  diff_hunk?: string;
  path?: string;
  commit_id?: string;
}

export interface DatabaseReview {
  github_id: string;
  pull_request_id: string;
  reviewer_id?: string;
  state: string;
  body: string;
  submitted_at: string;
  commit_id: string;
}
