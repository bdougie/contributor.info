// Database types for spam detection
export interface Database {
  public: {
    Tables: {
      pull_requests: {
        Row: {
          id: string;
          github_id: number;
          number: number;
          title: string;
          body: string | null;
          state: string;
          repository_id: string;
          author_id: string;
          base_branch: string;
          head_branch: string;
          draft: boolean;
          merged: boolean;
          created_at: string;
          updated_at: string;
          merged_at: string | null;
          closed_at: string | null;
          additions: number;
          deletions: number;
          changed_files: number;
          commits: number;
          html_url: string;
          spam_score: number | null;
          spam_flags: Record<string, unknown> | null;
          is_spam: boolean;
          reviewed_by_admin: boolean;
          spam_detected_at: string | null;
        };
      };
      contributors: {
        Row: {
          id: string;
          github_id: number;
          username: string;
          display_name: string;
          avatar_url: string;
          profile_url: string;
          discord_url: string | null;
          linkedin_url: string | null;
          is_bot: boolean;
          first_seen_at: string;
          last_updated_at: string;
          is_active: boolean;
        };
      };
      repositories: {
        Row: {
          id: string;
          github_id: number;
          full_name: string;
          owner: string;
          name: string;
          description: string | null;
          homepage: string | null;
          language: string | null;
          stargazers_count: number;
          watchers_count: number;
          forks_count: number;
          open_issues_count: number;
          size: number;
          default_branch: string;
          is_fork: boolean;
          is_private: boolean;
          is_archived: boolean;
          github_created_at: string;
          github_updated_at: string;
          github_pushed_at: string | null;
          last_updated_at: string;
          is_active: boolean;
        };
      };
    };
  };
}
