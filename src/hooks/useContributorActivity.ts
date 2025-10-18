import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  PersonaType,
  QualityScoreBreakdown,
  VelocityMetrics,
  TopicShift,
} from '@/lib/llm/contributor-enrichment-types';

export interface ContributorActivity {
  id: string;
  type: 'pr' | 'issue' | 'review' | 'comment' | 'discussion';
  title: string;
  repository: string;
  repository_full_name: string;
  url: string;
  created_at: string;
  state?: 'open' | 'closed' | 'merged';
  pr_number?: number;
  issue_number?: number;
  discussion_number?: number;
  // Discussion-specific fields
  discussion_category?: string;
  is_discussion_author?: boolean;
  discussion_comment_count?: number;
  is_answered?: boolean;
}

/**
 * Enriched contributor data with AI-powered analytics
 */
export interface ContributorEnrichmentData {
  /** Primary topics/expertise areas */
  topics: string[];

  /** Topic confidence score (0-1) */
  topicConfidence: number;

  /** Detected persona types */
  persona: PersonaType[];

  /** Persona confidence score (0-1) */
  personaConfidence: number;

  /** Contribution style classification */
  contributionStyle: 'code' | 'discussion' | 'mixed';

  /** Engagement pattern classification */
  engagementPattern: 'mentor' | 'learner' | 'reporter' | 'builder';

  /** Specific expertise areas */
  expertise: string[];

  /** Quality score breakdown */
  qualityMetrics: QualityScoreBreakdown;

  /** Velocity metrics (7d/30d) */
  velocity: VelocityMetrics;

  /** Detected topic shifts */
  topicShifts: TopicShift[];

  /** When this enrichment was last updated */
  lastUpdated: Date | null;
}

// Types for Supabase query results
interface RepositoryData {
  id: string;
  name: string;
  owner: string;
  full_name: string;
}

interface UseContributorActivityOptions {
  contributorUsername: string | undefined;
  workspaceId: string | undefined;
  pageSize?: number;
}

export function useContributorActivity({
  contributorUsername,
  workspaceId,
  pageSize = 20,
}: UseContributorActivityOptions) {
  const [activities, setActivities] = useState<ContributorActivity[]>([]);
  const [enrichment, setEnrichment] = useState<ContributorEnrichmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  /**
   * Fetch enrichment data from contributor_analytics and contributors tables
   */
  const fetchEnrichment = useCallback(async () => {
    if (!contributorUsername || !workspaceId) return;

    setEnrichmentLoading(true);

    try {
      // Fetch contributor ID and enrichment data
      const { data: contributorData, error: contributorError } = await supabase
        .from('contributors')
        .select(
          `
          id,
          primary_topics,
          topic_confidence,
          detected_persona,
          persona_confidence,
          contribution_style,
          engagement_pattern_type,
          expertise_areas,
          quality_score,
          discussion_impact_score,
          code_review_depth_score,
          issue_quality_score,
          mentor_score
        `
        )
        .eq('username', contributorUsername)
        .maybeSingle();

      if (contributorError) throw contributorError;
      if (!contributorData) {
        setEnrichment(null);
        return;
      }

      // Fetch latest analytics snapshot for velocity and topic shifts
      const { data: analyticsData } = await supabase
        .from('contributor_analytics')
        .select('contribution_velocity, topic_shifts, snapshot_date')
        .eq('contributor_id', contributorData.id)
        .eq('workspace_id', workspaceId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Parse quality metrics with defaults
      const qualityMetrics: QualityScoreBreakdown = {
        overall: contributorData.quality_score || 0,
        discussionImpact: contributorData.discussion_impact_score || 0,
        codeReviewDepth: contributorData.code_review_depth_score || 0,
        issueQuality: contributorData.issue_quality_score || 0,
        mentorScore: contributorData.mentor_score || 0,
        weights: {
          discussionImpact: 0.25,
          codeReviewDepth: 0.3,
          issueQuality: 0.25,
          mentorScore: 0.2,
        },
      };

      // Parse velocity metrics with defaults
      const velocityData = analyticsData?.contribution_velocity as {
        current7d?: number;
        previous7d?: number;
        current30d?: number;
        previous30d?: number;
        trend?: 'accelerating' | 'steady' | 'declining';
        changePercent?: number;
      } | null;

      const velocity: VelocityMetrics = {
        current7d: velocityData?.current7d || 0,
        previous7d: velocityData?.previous7d || 0,
        current30d: velocityData?.current30d || 0,
        previous30d: velocityData?.previous30d || 0,
        trend: velocityData?.trend || 'steady',
        changePercent: velocityData?.changePercent || 0,
      };

      // Parse topic shifts
      const topicShifts: TopicShift[] = (analyticsData?.topic_shifts as TopicShift[]) || [];

      // Build enrichment data
      const enrichmentData: ContributorEnrichmentData = {
        topics: contributorData.primary_topics || [],
        topicConfidence: contributorData.topic_confidence || 0,
        persona: (contributorData.detected_persona || []) as PersonaType[],
        personaConfidence: contributorData.persona_confidence || 0,
        contributionStyle:
          (contributorData.contribution_style as 'code' | 'discussion' | 'mixed') || 'mixed',
        engagementPattern:
          (contributorData.engagement_pattern_type as
            | 'mentor'
            | 'learner'
            | 'reporter'
            | 'builder') || 'builder',
        expertise: contributorData.expertise_areas || [],
        qualityMetrics,
        velocity,
        topicShifts,
        lastUpdated: analyticsData?.snapshot_date ? new Date(analyticsData.snapshot_date) : null,
      };

      setEnrichment(enrichmentData);
    } catch (err) {
      console.error('Error fetching contributor enrichment:', err);
      // Don't set error state - enrichment is optional
      setEnrichment(null);
    } finally {
      setEnrichmentLoading(false);
    }
  }, [contributorUsername, workspaceId]);

  const fetchActivities = useCallback(
    async (reset = false) => {
      if (!contributorUsername || !workspaceId) return;
      if (loading) return;
      if (!reset && !hasMore) return;

      setLoading(true);
      setError(null);

      const currentPage = reset ? 0 : page;

      // For combined queries, we need to fetch more data to account for the interleaving
      // of different activity types. We'll fetch more and then slice after sorting.
      const fetchLimit = (currentPage + 1) * pageSize * 4; // Fetch 4x to ensure coverage

      try {
        // Fetch contributor ID
        const { data: contributorData, error: contributorError } = await supabase
          .from('contributors')
          .select('id')
          .eq('username', contributorUsername)
          .maybeSingle();

        if (contributorError) throw contributorError;
        if (!contributorData) throw new Error('Contributor not found');

        const contributorId = contributorData.id;

        // First, get repository IDs for this workspace
        const { data: workspaceRepos } = await supabase
          .from('workspace_repositories')
          .select('repository_id')
          .eq('workspace_id', workspaceId);

        const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

        // Fetch activities from multiple tables - fetch more data initially
        const [pullRequests, issues, reviews, comments, discussions, discussionComments] =
          await Promise.all([
            // Pull Requests
            supabase
              .from('pull_requests')
              .select(
                `
              id,
              title,
              number,
              state,
              created_at,
              html_url,
              repository_id,
              repositories!inner(
                id,
                name,
                owner,
                full_name
              )
            `
              )
              .eq('author_id', contributorId)
              .in('repository_id', repoIds)
              .order('created_at', { ascending: false })
              .range(0, fetchLimit - 1),

            // Issues (without html_url which doesn't exist)
            supabase
              .from('issues')
              .select(
                `
              id,
              title,
              number,
              state,
              created_at,
              repository_id,
              repositories!inner(
                id,
                name,
                owner,
                full_name
              )
            `
              )
              .eq('author_id', contributorId)
              .in('repository_id', repoIds)
              .order('created_at', { ascending: false })
              .range(0, fetchLimit - 1),

            // Reviews (using correct table name)
            supabase
              .from('reviews')
              .select(
                `
              id,
              state,
              submitted_at,
              pull_request_id,
              pull_requests!inner(
                id,
                title,
                number,
                html_url,
                repository_id
              )
            `
              )
              .eq('reviewer_id', contributorId)
              .in('pull_requests.repository_id', repoIds)
              .order('submitted_at', { ascending: false })
              .range(0, fetchLimit - 1),

            // Comments (from comments table filtered by issue_id)
            supabase
              .from('comments')
              .select(
                `
              id,
              body,
              created_at,
              issue_id,
              issues!inner(
                id,
                title,
                number,
                repository_id
              )
            `
              )
              .eq('commenter_id', contributorId)
              .not('issue_id', 'is', null)
              .in('issues.repository_id', repoIds)
              .order('created_at', { ascending: false })
              .range(0, fetchLimit - 1),

            // Discussions authored by contributor
            supabase
              .from('discussions')
              .select(
                `
              id,
              title,
              number,
              created_at,
              category_name,
              is_answered,
              comment_count,
              url,
              repository_id,
              repositories!inner(
                id,
                name,
                owner,
                full_name
              )
            `
              )
              .eq('author_id', contributorId)
              .in('repository_id', repoIds)
              .order('created_at', { ascending: false })
              .range(0, fetchLimit - 1),

            // Discussion comments by contributor
            supabase
              .from('discussion_comments')
              .select(
                `
              id,
              created_at,
              discussion_id,
              discussions!inner(
                id,
                title,
                number,
                category_name,
                is_answered,
                url,
                repository_id,
                repositories!inner(
                  id,
                  name,
                  owner,
                  full_name
                )
              )
            `
              )
              .eq('author_id', contributorId)
              .order('created_at', { ascending: false })
              .range(0, fetchLimit - 1),
          ]);

        // Transform and combine activities
        const allActivities: ContributorActivity[] = [];

        // Process pull requests
        if (pullRequests.data) {
          pullRequests.data.forEach((pr) => {
            const repository = pr.repositories as unknown as RepositoryData;
            if (repository) {
              allActivities.push({
                id: pr.id,
                type: 'pr',
                title: pr.title || `Pull Request #${pr.number}`,
                repository: repository.name,
                repository_full_name: repository.full_name,
                url: pr.html_url || `https://github.com/${repository.full_name}/pull/${pr.number}`,
                created_at: pr.created_at,
                state: pr.state === 'merged' ? 'merged' : (pr.state as 'open' | 'closed'),
                pr_number: pr.number,
              });
            }
          });
        }

        // Process issues
        if (issues.data) {
          issues.data.forEach((issue) => {
            const repository = issue.repositories as unknown as RepositoryData;
            if (repository) {
              allActivities.push({
                id: issue.id,
                type: 'issue',
                title: issue.title || `Issue #${issue.number}`,
                repository: repository.name,
                repository_full_name: repository.full_name,
                // Generate URL since issues don't have html_url
                url: `https://github.com/${repository.full_name}/issues/${issue.number}`,
                created_at: issue.created_at,
                state: issue.state as 'open' | 'closed',
                issue_number: issue.number,
              });
            }
          });
        }

        // Process reviews - fetch repository data separately
        if (reviews.data && reviews.data.length > 0) {
          // Get unique repository IDs from pull requests
          const prIds = reviews.data
            .map((r) => {
              // Handle both single object and array cases
              const pr = Array.isArray(r.pull_requests) ? r.pull_requests[0] : r.pull_requests;
              return pr?.repository_id;
            })
            .filter((id): id is string => !!id);

          const uniqueRepoIds = [...new Set(prIds)];

          // Fetch repository data
          const { data: repoData } = await supabase
            .from('repositories')
            .select('id, name, owner, full_name')
            .in('id', uniqueRepoIds);

          const repoMap = new Map(repoData?.map((r) => [r.id, r]) || []);

          reviews.data.forEach((review) => {
            // Handle both single object and array cases
            const pullRequest = Array.isArray(review.pull_requests)
              ? review.pull_requests[0]
              : review.pull_requests;
            if (pullRequest?.repository_id) {
              const repository = repoMap.get(pullRequest.repository_id);
              if (repository) {
                allActivities.push({
                  id: review.id,
                  type: 'review',
                  title: `Review on: ${pullRequest.title || `PR #${pullRequest.number}`}`,
                  repository: repository.name,
                  repository_full_name: repository.full_name,
                  url:
                    pullRequest.html_url ||
                    `https://github.com/${repository.full_name}/pull/${pullRequest.number}`,
                  created_at: review.submitted_at,
                  state: review.state === 'APPROVED' ? 'merged' : 'open',
                });
              }
            }
          });
        }

        // Process comments - fetch repository data separately
        if (comments.data && comments.data.length > 0) {
          // Get unique repository IDs from issues
          const issueRepoIds = comments.data
            .map((c) => {
              // Handle both single object and array cases
              const issue = Array.isArray(c.issues) ? c.issues[0] : c.issues;
              return issue?.repository_id;
            })
            .filter((id): id is string => !!id);

          const uniqueIssueRepoIds = [...new Set(issueRepoIds)];

          // Fetch repository data
          const { data: issueRepoData } = await supabase
            .from('repositories')
            .select('id, name, owner, full_name')
            .in('id', uniqueIssueRepoIds);

          const issueRepoMap = new Map(issueRepoData?.map((r) => [r.id, r]) || []);

          comments.data.forEach((comment) => {
            // Handle both single object and array cases
            const issue = Array.isArray(comment.issues) ? comment.issues[0] : comment.issues;
            if (issue?.repository_id) {
              const repository = issueRepoMap.get(issue.repository_id);
              if (repository) {
                allActivities.push({
                  id: comment.id,
                  type: 'comment',
                  title: `Comment on: ${issue.title || `Issue #${issue.number}`}`,
                  repository: repository.name,
                  repository_full_name: repository.full_name,
                  // Generate URL since comments don't have html_url
                  url: `https://github.com/${repository.full_name}/issues/${issue.number}`,
                  created_at: comment.created_at,
                });
              }
            }
          });
        }

        // Process discussions authored by contributor
        if (discussions.data) {
          discussions.data.forEach((discussion) => {
            const repository = discussion.repositories as unknown as RepositoryData;
            if (repository) {
              allActivities.push({
                id: discussion.id,
                type: 'discussion',
                title: discussion.title,
                repository: repository.name,
                repository_full_name: repository.full_name,
                url: discussion.url,
                created_at: discussion.created_at,
                discussion_number: discussion.number,
                discussion_category: discussion.category_name || undefined,
                is_discussion_author: true,
                discussion_comment_count: discussion.comment_count || 0,
                is_answered: discussion.is_answered || false,
              });
            }
          });
        }

        // Process discussion comments - repository data now included in query
        if (discussionComments.data) {
          discussionComments.data.forEach((comment) => {
            const discussion = Array.isArray(comment.discussions)
              ? comment.discussions[0]
              : comment.discussions;
            if (discussion) {
              // Repository data is now nested within discussion
              const repository = Array.isArray(discussion.repositories)
                ? discussion.repositories[0]
                : discussion.repositories;
              if (repository) {
                allActivities.push({
                  id: comment.id,
                  type: 'discussion',
                  title: `Comment on: ${discussion.title}`,
                  repository: repository.name,
                  repository_full_name: repository.full_name,
                  url: discussion.url,
                  created_at: comment.created_at,
                  discussion_number: discussion.number,
                  discussion_category: discussion.category_name || undefined,
                  is_discussion_author: false,
                  discussion_comment_count: 1, // This comment
                  is_answered: discussion.is_answered || false,
                });
              }
            }
          });
        }

        // Sort all activities by date
        allActivities.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Properly paginate the combined results
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        const pageActivities = allActivities.slice(startIndex, endIndex);

        if (reset) {
          setActivities(pageActivities);
          setPage(1);
        } else {
          setActivities((prev) => [...prev, ...pageActivities]);
          setPage((prev) => prev + 1);
        }

        // Check if there are more activities beyond what we're showing
        setHasMore(allActivities.length > endIndex);
      } catch (err) {
        console.error('Error fetching contributor activity:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch activity');
      } finally {
        setLoading(false);
      }
    },
    [contributorUsername, workspaceId, pageSize, page, hasMore, loading]
  );

  const loadMore = useCallback(() => {
    fetchActivities(false);
  }, [fetchActivities]);

  const refresh = useCallback(() => {
    setPage(0);
    setHasMore(true);
    fetchActivities(true);
  }, [fetchActivities]);

  useEffect(() => {
    if (contributorUsername && workspaceId) {
      refresh();
      fetchEnrichment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorUsername, workspaceId]);

  return {
    activities,
    enrichment,
    loading,
    enrichmentLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    refreshEnrichment: fetchEnrichment,
  };
}
