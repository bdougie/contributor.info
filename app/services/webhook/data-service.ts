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
   */
  async storeIssue(issue: Issue, repoId: string): Promise<string | null> {
    try {
      // Get author ID (atomic upsert)
      const authorId = await this.upsertContributor(issue.user);
      if (!authorId) {
        console.error('Failed to upsert contributor for issue: %s', issue.id);
        return null;
      }

      // Store issue (atomic upsert)
      const { data: issueData, error } = await supabase
        .from('issues')
        .upsert({
          github_id: issue.id,
          repository_id: repoId,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          author_id: authorId,
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
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error upserting issue: %o', error);
        throw error;
      }

      return issueData?.id || null;
    } catch (error) {
      console.error('Error storing issue: %o', error);
      throw error;
    }
  }

  /**
   * Store or update a pull request in the database
   * Note: Operations are sequenced to ensure consistency
   */
  async storePR(pr: PullRequest, repoId: string): Promise<string | null> {
    try {
      // Get author ID (atomic upsert)
      const authorId = await this.upsertContributor(pr.user);
      if (!authorId) {
        console.error('Failed to upsert contributor for PR: %s', pr.id);
        return null;
      }

      // Store PR (atomic upsert)
      const { data: prData, error } = await supabase
        .from('pull_requests')
        .upsert({
          github_id: pr.id,
          repository_id: repoId,
          number: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          author_id: authorId,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          draft: pr.draft,
          head_sha: pr.head?.sha,
          base_branch: pr.base?.ref,
          head_branch: pr.head?.ref,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error upserting pull request: %o', error);
        throw error;
      }

      return prData?.id || null;
    } catch (error) {
      console.error('Error storing pull request: %o', error);
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
