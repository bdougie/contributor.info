export interface PullRequestActivity {
  id: number;
  title: string;
  number?: number;
  html_url?: string;
  user?: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  created_at?: string;
  updated_at?: string;
  state?: string;
  body?: string;
  // Add any other properties you need from GitHub PR data
}