import { supabase } from '../supabase';

/**
 * Processor for fetching and storing PR reviews and comments
 */
export class ReviewCommentProcessor {
  private static readonly GITHUB_API_BASE = 'https://api.github.com';

  /**
   * Get GitHub API headers with authentication
   */
  private static async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ContributorInfo/1.0',
    };

    // Try to get user's GitHub token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const userToken = session?.provider_token;

    // Use user's token if available, otherwise fall back to env token
    const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    return headers;
  }

  /**
   * Process a reviews job - fetch and store PR reviews
   */
  static async processReviewsJob(repositoryId: string, prNumber: string, meta_data: unknown): Promise<{ success: boolean; error?: string }> {
    try {

      // Get repository info to construct GitHub API URL
      const { data: repo, error: _error: repoError } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (repoError || !repo) {
        return { success: false, error: `Repository not found: ${repoError?.message}` };
      }

      // Fetch reviews from GitHub API
      const headers = await this.getHeaders();
      const response = await fetch(
        `${this.GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}/pulls/${prNumber}/reviews`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true }; // Not an error, just no reviews
        }
        return { success: false, error: `GitHub API error: ${response.status} ${response.statusText}` };
      }

      const reviews = await response.json();
      
      if (!Array.isArray(reviews) || reviews.length === 0) {
        return { success: true };
      }


      // Process each review
      let processed = 0;
      for (const review of reviews) {
        try {
          // Find or create reviewer
          const { data: reviewer, error: _error: reviewerError } = await supabase
            .from('contributors')
            .upsert({
              github_id: review.user.id,
              username: review.user.login,
              display_name: review.user.login,
              avatar_url: review.user.avatar_url,
              profile_url: review.user.html_url,
              is_bot: review.user.type === 'Bot',
              first_seen_at: new Date().toISOString(),
              last_updated_at: new Date().toISOString(),
              is_active: true
            }, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            })
            .select()
            .maybeSingle();

          if (reviewerError) {
            console.warn(`[Reviews Processor] Error upserting reviewer ${review.user.login}:`, reviewerError);
            continue;
          }

          // Insert review
          const { error: _error: reviewInsertError } = await supabase
            .from('reviews')
            .upsert({
              github_id: review.id,
              pull_request_id: metadata.pr_id,
              reviewer_id: reviewer.id,
              state: review.state,
              body: review.body || null,
              submitted_at: review.submitted_at,
              commit_id: review.commit_id || null
            }, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            });

          if (reviewInsertError) {
            console.warn(`[Reviews Processor] Error inserting review ${review.id}:`, reviewInsertError);
          } else {
            processed++;
          }

        } catch (reviewError) {
          console.warn(`[Reviews Processor] Error processing review ${review.id}:`, reviewError);
        }
      }

      return { success: true };

    } catch (_error) {
      console.error(`[Reviews Processor] Error processing reviews for PR #${prNumber}:`, _error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Process a comments job - fetch and store PR comments
   */
  static async processCommentsJob(repositoryId: string, prNumber: string, meta_data: unknown): Promise<{ success: boolean; error?: string }> {
    try {

      // Get repository info to construct GitHub API URL
      const { data: repo, error: _error: repoError } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (repoError || !repo) {
        return { success: false, error: `Repository not found: ${repoError?.message}` };
      }

      const headers = await this.getHeaders();
      
      // Fetch both PR review comments and issue comments in parallel
      const [reviewCommentsResponse, issueCommentsResponse] = await Promise.all([
        fetch(`${this.GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}/pulls/${prNumber}/comments`, { headers }),
        fetch(`${this.GITHUB_API_BASE}/repos/${repo.owner}/${repo.name}/issues/${prNumber}/comments`, { headers })
      ]);

      const allComments: unknown[] = [];

      // Process review comments
      if (reviewCommentsResponse.ok) {
        const reviewComments = await reviewCommentsResponse.json();
        if (Array.isArray(reviewComments)) {
          allComments.push(...reviewComments.map(comment => ({
            ...comment,
            comment_type: 'review_comment'
          })));
        }
      } else if (reviewCommentsResponse.status !== 404) {
        console.warn(`[Comments Processor] Error fetching review comments: ${reviewCommentsResponse.status}`);
      }

      // Process issue comments
      if (issueCommentsResponse.ok) {
        const issueComments = await issueCommentsResponse.json();
        if (Array.isArray(issueComments)) {
          allComments.push(...issueComments.map(comment => ({
            ...comment,
            comment_type: 'issue_comment'
          })));
        }
      } else if (issueCommentsResponse.status !== 404) {
        console.warn(`[Comments Processor] Error fetching issue comments: ${issueCommentsResponse.status}`);
      }

      if (allComments.length === 0) {
        return { success: true };
      }


      // Process each comment
      let processed = 0;
      for (const comment of allComments) {
        try {
          // Find or create commenter
          const { data: commenter, error: _error: commenterError } = await supabase
            .from('contributors')
            .upsert({
              github_id: comment.user.id,
              username: comment.user.login,
              display_name: comment.user.login,
              avatar_url: comment.user.avatar_url,
              profile_url: comment.user.html_url,
              is_bot: comment.user.type === 'Bot',
              first_seen_at: new Date().toISOString(),
              last_updated_at: new Date().toISOString(),
              is_active: true
            }, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            })
            .select()
            .maybeSingle();

          if (commenterError) {
            console.warn(`[Comments Processor] Error upserting commenter ${comment.user.login}:`, commenterError);
            continue;
          }

          // Insert comment
          const { error: _error: commentInsertError } = await supabase
            .from('comments')
            .upsert({
              github_id: comment.id,
              repository_id: repositoryId,
              pull_request_id: metadata.pr_id,
              commenter_id: commenter.id,
              body: comment.body,
              created_at: comment.created_at,
              updated_at: comment.updated_at || comment.created_at,
              comment_type: comment.comment_type,
              in_reply_to_id: comment.in_reply_to_id || null,
              position: comment.position || null,
              original_position: comment.original_position || null,
              diff_hunk: comment.diff_hunk || null,
              path: comment.path || null,
              commit_id: comment.commit_id || null
            }, {
              onConflict: 'github_id',
              ignoreDuplicates: false
            });

          if (commentInsertError) {
            console.warn(`[Comments Processor] Error inserting comment ${comment.id}:`, commentInsertError);
          } else {
            processed++;
          }

        } catch (commentError) {
          console.warn(`[Comments Processor] Error processing comment ${comment.id}:`, commentError);
        }
      }

      return { success: true };

    } catch (_error) {
      console.error(`[Comments Processor] Error processing comments for PR #${prNumber}:`, _error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}