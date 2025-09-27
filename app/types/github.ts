/**
 * GitHub webhook event types and payloads
 */

export interface WebhookEvent<T = any> {
  id: string;
  name: string;
  payload: T;
  signature: string;
  event: string;
}

export interface Repository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    type: 'User' | 'Organization';
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  language: string | null;
  default_branch: string;
}

export interface User {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Bot';
  name?: string;
  email?: string;
}

export interface PullRequest {
  id: number;
  node_id: string;
  html_url: string;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  user: User;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignee: User | null;
  assignees: User[];
  requested_reviewers: User[];
  requested_teams: any[];
  labels: Label[];
  draft: boolean;
  head: {
    label: string;
    ref: string;
    sha: string;
    repo: Repository | null;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    repo: Repository;
  };
  author_association: string;
  auto_merge: any | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface Issue {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  user: User;
  labels: Label[];
  assignee: User | null;
  assignees: User[];
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  pull_request?: {
    url: string;
    html_url: string;
  };
}

export interface Label {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string | null;
}

export interface Installation {
  id: number;
  account: {
    login: string;
    id: number;
    type: 'User' | 'Organization';
  };
  repository_selection: 'all' | 'selected';
  access_tokens_url: string;
  repositories_url: string;
  html_url: string;
  app_id: number;
  app_slug: string;
  created_at: string;
  updated_at: string;
  suspended_by: User | null;
  suspended_at: string | null;
}

// Webhook payload types
export interface PullRequestEvent {
  action:
    | 'opened'
    | 'edited'
    | 'closed'
    | 'assigned'
    | 'unassigned'
    | 'review_requested'
    | 'review_request_removed'
    | 'ready_for_review'
    | 'labeled'
    | 'unlabeled'
    | 'synchronize'
    | 'reopened';
  number: number;
  pull_request: PullRequest;
  repository: Repository;
  installation?: Installation;
  sender: User;
}

export interface IssuesEvent {
  action:
    | 'opened'
    | 'edited'
    | 'deleted'
    | 'transferred'
    | 'pinned'
    | 'unpinned'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'milestoned'
    | 'demilestoned';
  issue: Issue;
  repository: Repository;
  installation?: Installation;
  sender: User;
}

export interface InstallationEvent {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | 'new_permissions_accepted';
  installation: Installation;
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  sender: User;
}

export interface InstallationRepositoriesEvent {
  action: 'added' | 'removed';
  installation: Installation;
  repository_selection: 'all' | 'selected';
  repositories_added?: Repository[];
  repositories_removed?: Repository[];
  sender: User;
}

export interface IssueCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  issue: Issue;
  comment: {
    id: number;
    node_id: string;
    url: string;
    html_url: string;
    body: string;
    user: User;
    created_at: string;
    updated_at: string;
    author_association: string;
  };
  repository: Repository;
  installation?: Installation;
  sender: User;
}
