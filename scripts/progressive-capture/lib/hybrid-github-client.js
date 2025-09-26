import { Octokit } from '@octokit/rest';
import { GitHubGraphQLClient } from './graphql-client.js';
import {
  GET_PR_COMPLETE_DATA,
  GET_PR_REVIEWS,
  GET_PR_COMMENTS,
  GET_RECENT_PRS,
  buildBatchPRQuery,
} from './graphql-queries.js';

export class HybridGitHubClient {
  constructor(token) {
    this.rest = new Octokit({ auth: token });
    this.graphql = new GitHubGraphQLClient(token);
    this.useGraphQL = true; // Can be toggled for testing
    this.metrics = {
      graphqlQueries: 0,
      restQueries: 0,
      fallbacks: 0,
      totalPointsSaved: 0,
    };
  }

  async getPRCompleteData(owner, repo, prNumber) {
    if (this.useGraphQL) {
      try {
        const result = await this.graphql.query(GET_PR_COMPLETE_DATA, {
          owner,
          repo,
          number: prNumber,
        });

        this.metrics.graphqlQueries++;

        // Transform GraphQL response to match our expected format
        const transformed = this.transformPRCompleteData(result);

        // Calculate points saved vs REST approach
        const pointsSaved = this.calculatePointsSaved(5, result.rateLimit.cost);
        this.metrics.totalPointsSaved += pointsSaved;

        return transformed;
      } catch (error) {
        console.warn(`GraphQL failed for PR ${prNumber}, falling back to REST:`, error.message);
        this.metrics.fallbacks++;
        return await this.getPRCompleteDataREST(owner, repo, prNumber);
      }
    } else {
      return await this.getPRCompleteDataREST(owner, repo, prNumber);
    }
  }

  async getPRCompleteDataREST(owner, repo, prNumber) {
    try {
      // Multiple REST calls (same as original implementation)
      const [
        { data: prData },
        { data: files },
        { data: reviews },
        { data: issueComments },
        { data: reviewComments },
      ] = await Promise.all([
        this.rest.pulls.get({ owner, repo, pull_number: prNumber }),
        this.rest.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 }),
        this.rest.pulls.listReviews({ owner, repo, pull_number: prNumber, per_page: 100 }),
        this.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 }),
        this.rest.pulls.listReviewComments({ owner, repo, pull_number: prNumber, per_page: 100 }),
      ]);

      this.metrics.restQueries += 5;

      return {
        pullRequest: prData,
        files: files,
        reviews: reviews,
        issueComments: issueComments,
        reviewComments: reviewComments,
        rateLimit: {
          cost: 5, // 5 REST calls
          remaining: 5000, // Estimate
          limit: 5000,
        },
      };
    } catch (error) {
      console.error(`REST API failed for PR ${prNumber}:`, error.message);
      throw error;
    }
  }

  async getPRReviews(owner, repo, prNumber) {
    if (this.useGraphQL) {
      try {
        const result = await this.graphql.query(GET_PR_REVIEWS, {
          owner,
          repo,
          number: prNumber,
        });

        this.metrics.graphqlQueries++;
        return this.transformPRReviews(result);
      } catch (error) {
        console.warn(
          `GraphQL reviews failed for PR ${prNumber}, falling back to REST:`,
          error.message
        );
        this.metrics.fallbacks++;
        return await this.getPRReviewsREST(owner, repo, prNumber);
      }
    } else {
      return await this.getPRReviewsREST(owner, repo, prNumber);
    }
  }

  async getPRReviewsREST(owner, repo, prNumber) {
    const { data: reviews } = await this.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    this.metrics.restQueries++;
    return { reviews };
  }

  async getPRComments(owner, repo, prNumber) {
    if (this.useGraphQL) {
      try {
        const result = await this.graphql.query(GET_PR_COMMENTS, {
          owner,
          repo,
          number: prNumber,
        });

        this.metrics.graphqlQueries++;
        return this.transformPRComments(result);
      } catch (error) {
        console.warn(
          `GraphQL comments failed for PR ${prNumber}, falling back to REST:`,
          error.message
        );
        this.metrics.fallbacks++;
        return await this.getPRCommentsREST(owner, repo, prNumber);
      }
    } else {
      return await this.getPRCommentsREST(owner, repo, prNumber);
    }
  }

  async getPRCommentsREST(owner, repo, prNumber) {
    const [{ data: issueComments }, { data: reviewComments }] = await Promise.all([
      this.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 }),
      this.rest.pulls.listReviewComments({ owner, repo, pull_number: prNumber, per_page: 100 }),
    ]);

    this.metrics.restQueries += 2;
    return { issueComments, reviewComments };
  }

  async getRecentPRs(owner, repo, since, limit = 50) {
    if (this.useGraphQL) {
      try {
        const result = await this.graphql.query(GET_RECENT_PRS, {
          owner,
          repo,
          since,
          first: limit,
        });

        this.metrics.graphqlQueries++;
        return this.transformRecentPRs(result);
      } catch (error) {
        console.warn(`GraphQL recent PRs failed, falling back to REST:`, error.message);
        this.metrics.fallbacks++;
        return await this.getRecentPRsREST(owner, repo, since, limit);
      }
    } else {
      return await this.getRecentPRsREST(owner, repo, since, limit);
    }
  }

  async getRecentPRsREST(owner, repo, since, limit = 50) {
    const { data: prs } = await this.rest.pulls.list({
      owner,
      repo,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: limit,
      since,
    });

    this.metrics.restQueries++;
    return prs;
  }

  // Transform GraphQL responses to match expected format
  transformPRCompleteData(result) {
    const pr = result.repository.pullRequest;

    return {
      pullRequest: {
        id: pr.databaseId,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state.toLowerCase(),
        draft: pr.isDraft,
        user: {
          id: pr.author?.id,
          login: pr.author?.login,
          avatar_url: pr.author?.avatarUrl,
        },
        created_at: pr.createdAt,
        updated_at: pr.updatedAt,
        closed_at: pr.closedAt,
        merged_at: pr.mergedAt,
        merged: pr.merged,
        mergeable: pr.mergeable,
        merged_by: pr.mergedBy
          ? {
              id: pr.mergedBy.id,
              login: pr.mergedBy.login,
              avatar_url: pr.mergedBy.avatarUrl,
            }
          : null,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changedFiles,
        commits: pr.commits.totalCount,
        base: { ref: pr.baseRefName },
        head: { ref: pr.headRefName },
      },
      files:
        pr.files?.nodes?.map((file) => ({
          filename: file.path,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.additions + file.deletions,
          status: file.changeType?.toLowerCase() || 'modified',
        })) || [],
      reviews: pr.reviews.nodes.map((review) => ({
        id: review.databaseId,
        state: review.state,
        body: review.body,
        user: {
          id: review.author?.id,
          login: review.author?.login,
          avatar_url: review.author?.avatarUrl,
        },
        submitted_at: review.submittedAt,
        commit_id: review.commit?.oid,
      })),
      issueComments: pr.comments.nodes.map((comment) => ({
        id: comment.databaseId,
        body: comment.body,
        user: {
          id: comment.author?.id,
          login: comment.author?.login,
          avatar_url: comment.author?.avatarUrl,
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
      })),
      reviewComments: pr.reviewComments.nodes.map((comment) => ({
        id: comment.databaseId,
        body: comment.body,
        path: comment.path,
        position: comment.position,
        original_position: comment.originalPosition,
        diff_hunk: comment.diffHunk,
        user: {
          id: comment.author?.id,
          login: comment.author?.login,
          avatar_url: comment.author?.avatarUrl,
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        in_reply_to_id: comment.inReplyTo?.databaseId,
        pull_request_review_id: comment.pullRequestReview?.databaseId,
      })),
      rateLimit: result.rateLimit,
    };
  }

  transformPRReviews(result) {
    const pr = result.repository.pullRequest;
    return {
      reviews: pr.reviews.nodes.map((review) => ({
        id: review.databaseId,
        state: review.state,
        body: review.body,
        user: {
          id: review.author?.id,
          login: review.author?.login,
          avatar_url: review.author?.avatarUrl,
        },
        submitted_at: review.submittedAt,
        commit_id: review.commit?.oid,
      })),
      rateLimit: result.rateLimit,
    };
  }

  transformPRComments(result) {
    const pr = result.repository.pullRequest;
    return {
      issueComments: pr.comments.nodes.map((comment) => ({
        id: comment.databaseId,
        body: comment.body,
        user: {
          id: comment.author?.id,
          login: comment.author?.login,
          avatar_url: comment.author?.avatarUrl,
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
      })),
      reviewComments: pr.reviewComments.nodes.map((comment) => ({
        id: comment.databaseId,
        body: comment.body,
        path: comment.path,
        position: comment.position,
        original_position: comment.originalPosition,
        diff_hunk: comment.diffHunk,
        user: {
          id: comment.author?.id,
          login: comment.author?.login,
          avatar_url: comment.author?.avatarUrl,
        },
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        in_reply_to_id: comment.inReplyTo?.databaseId,
        pull_request_review_id: comment.pullRequestReview?.databaseId,
      })),
      rateLimit: result.rateLimit,
    };
  }

  transformRecentPRs(result) {
    return result.repository.pullRequests.nodes.map((pr) => ({
      number: pr.number,
      updated_at: pr.updatedAt,
      state: pr.state.toLowerCase(),
      title: pr.title,
      author: {
        login: pr.author?.login,
      },
    }));
  }

  calculatePointsSaved(restCalls, graphqlCost) {
    return Math.max(0, restCalls - graphqlCost);
  }

  // Get performance metrics
  getMetrics() {
    return {
      ...this.metrics,
      totalQueries: this.metrics.graphqlQueries + this.metrics.restQueries,
      fallbackRate:
        (this.metrics.fallbacks / (this.metrics.graphqlQueries + this.metrics.fallbacks)) * 100,
      efficiency:
        this.metrics.totalPointsSaved / (this.metrics.graphqlQueries + this.metrics.restQueries),
    };
  }

  // Enable/disable GraphQL
  setGraphQLEnabled(enabled) {
    this.useGraphQL = enabled;
  }

  // Get rate limit info
  getRateLimit() {
    return this.graphql.getRateLimit();
  }
}
