import { supabase } from '../../../src/lib/supabase';
import type {
  Repository as GitHubRepository,
  User as GitHubUser,
  Issue,
  PullRequest,
  Label,
} from '../../types/github';

// Type for issue assignees stored in database
interface IssueAssignee {
  id: number;
  login: string;
}

/**
 * WebhookDataService - Shared data operations for webhook handlers
 *
 * Eliminates duplication across webhook handlers by providing consistent
 * patterns for repository, contributor, issue, and PR storage.
 */
export class WebhookDataService {
  /**
   * Ensure repository exists in database and return its ID
   * Returns null if repository is not tracked
   */
  async ensureRepository(repo: GitHubRepository): Promise<string | null> {
    try {
      const { data: repository } = await supabase
        .from('repositories')
        .select('id')
        .eq('github_id', repo.id)
        .maybeSingle();

      if (!repository) {
        console.log('Repository %s not tracked, skipping', repo.full_name);
        return null;
      }

      return repository.id;
    } catch (error) {
      console.error('Error checking repository: %o', error);
      throw error;
    }
  }

  /**
   * Upsert contributor and return their ID
   */
  async upsertContributor(user: GitHubUser): Promise<string | null> {
    try {
      const { data: contributor } = await supabase
        .from('contributors')
        .upsert({
          github_id: user.id,
          github_login: user.login,
          avatar_url: user.avatar_url,
          html_url: user.html_url,
          type: user.type,
        })
        .select('id')
        .maybeSingle();

      return contributor?.id || null;
    } catch (error) {
      console.error('Error upserting contributor: %o', error);
      throw error;
    }
  }

  /**
   * Store or update an issue in the database
   * Note: Operations are sequenced to ensure consistency
   *
   * Implements graceful degradation: if contributor resolution fails,
   * issue is still stored for later recovery/backfill
   */
  async storeIssue(issue: Issue, repoId: string): Promise<string | null> {
    try {
      // Attempt to get author ID (atomic upsert)
      let authorId: string | null = null;
      try {
        authorId = await this.upsertContributor(issue.user);
        if (!authorId) {
          console.warn(
            'Failed to upsert contributor for issue %s (author: %s). Issue will be stored without author_id for later recovery.',
            issue.id,
            issue.user?.login
          );
        }
      } catch (contributorError) {
        console.error(
          'Error upserting contributor for issue %s: %o. Issue will be stored without author_id.',
          issue.id,
          contributorError
        );
        // Continue to store issue even if contributor fails
      }

      // Store issue (atomic upsert) - with or without author_id
      const issueData: Record<string, unknown> = {
        github_id: issue.id,
        repository_id: repoId,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        labels: issue.labels,
        assignees:
          issue.assignees?.map((a) => ({
            id: a.id,
            login: a.login,
          })) || [],
        comments_count: issue.comments || 0,
        is_pull_request: !!issue.pull_request,
      };

      // Only include author_id if successfully resolved
      if (authorId) {
        issueData.author_id = authorId;
      }

      const { data: storedIssue, error } = await supabase
        .from('issues')
        .upsert(issueData)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error upserting issue %s: %o', issue.id, error);
        throw error;
      }

      if (!storedIssue?.id) {
        console.error('Issue %s stored but no ID returned', issue.id);
        return null;
      }

      return storedIssue.id;
    } catch (error) {
      console.error('Error storing issue %s: %o', issue.id, error);
      throw error;
    }
  }

  /**
   * Store or update a pull request in the database
   * Note: Operations are sequenced to ensure consistency
   *
   * Implements graceful degradation: if contributor resolution fails,
   * PR is still stored for later recovery/backfill
   */
  async storePR(pr: PullRequest, repoId: string): Promise<string | null> {
    try {
      // Attempt to get author ID (atomic upsert)
      let authorId: string | null = null;
      try {
        authorId = await this.upsertContributor(pr.user);
        if (!authorId) {
          console.warn(
            'Failed to upsert contributor for PR %s (author: %s). PR will be stored without author_id for later recovery.',
            pr.id,
            pr.user?.login
          );
        }
      } catch (contributorError) {
        console.error(
          'Error upserting contributor for PR %s: %o. PR will be stored without author_id.',
          pr.id,
          contributorError
        );
        // Continue to store PR even if contributor fails
      }

      // Store PR (atomic upsert) - with or without author_id
      const prData: Record<string, unknown> = {
        github_id: pr.id,
        repository_id: repoId,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        draft: pr.draft,
        head_sha: pr.head?.sha,
        base_branch: pr.base?.ref,
        head_branch: pr.head?.ref,
      };

      // Only include author_id if successfully resolved
      if (authorId) {
        prData.author_id = authorId;
      }

      const { data: storedPR, error } = await supabase
        .from('pull_requests')
        .upsert(prData)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error upserting pull request %s: %o', pr.id, error);
        throw error;
      }

      if (!storedPR?.id) {
        console.error('Pull request %s stored but no ID returned', pr.id);
        return null;
      }

      return storedPR.id;
    } catch (error) {
      console.error('Error storing pull request %s: %o', pr.id, error);
      throw error;
    }
  }

  /**
   * Update issue state (for closed/reopened events)
   */
  async updateIssueState(
    githubId: number,
    state: 'open' | 'closed',
    closedAt?: string | null,
    closedById?: number | null
  ): Promise<void> {
    try {
      await supabase
        .from('issues')
        .update({
          state,
          closed_at: closedAt,
          closed_by_id: closedById,
          updated_at: new Date().toISOString(),
        })
        .eq('github_id', githubId);
    } catch (error) {
      console.error('Error updating issue state: %o', error);
      throw error;
    }
  }

  /**
   * Update issue metadata (for edited/labeled events)
   */
  async updateIssueMetadata(
    githubId: number,
    updates: {
      title?: string;
      body?: string;
      labels?: Label[];
      assignees?: IssueAssignee[];
      updated_at?: string;
    }
  ): Promise<void> {
    try {
      await supabase
        .from('issues')
        .update({
          ...updates,
          updated_at: updates.updated_at || new Date().toISOString(),
        })
        .eq('github_id', githubId);
    } catch (error) {
      console.error('Error updating issue metadata: %o', error);
      throw error;
    }
  }
}

// Export singleton instance
export const webhookDataService = new WebhookDataService();
