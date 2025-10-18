/**
 * Quality Scoring Service
 * Multi-factor scoring for contributor engagement quality
 */

import { supabase } from '@/lib/supabase';
import type { QualityScoreBreakdown } from '@/lib/llm/contributor-enrichment-types';

/**
 * Quality weights configuration (must sum to 1.0)
 */
const QUALITY_WEIGHTS = {
  discussionImpact: 0.25,
  codeReviewDepth: 0.3,
  issueQuality: 0.25,
  mentorScore: 0.2,
};

/**
 * Discussion impact metrics
 */
interface DiscussionMetrics {
  totalDiscussions: number;
  answered: number;
  comments: number;
  reactionsReceived: number;
}

/**
 * Code review metrics
 */
interface CodeReviewMetrics {
  totalReviews: number;
  approvals: number;
  changesRequested: number;
  commentedReviews: number;
  avgCommentsPerReview: number;
}

/**
 * Issue quality metrics
 */
interface IssueMetrics {
  totalIssues: number;
  closedIssues: number;
  issuesWithDetails: number;
  reactionsReceived: number;
}

/**
 * Mentor behavior metrics
 */
interface MentorMetrics {
  helpfulComments: number;
  questionsAnswered: number;
  documentationContributions: number;
}

/**
 * Calculate discussion impact score (0-100)
 * Measures how valuable the contributor's discussions are
 */
async function calculateDiscussionImpact(
  contributorId: string,
  workspaceId: string
): Promise<number> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) return 0;

  // Fetch discussion metrics
  const { data: discussions } = await supabase
    .from('discussions')
    .select('id, is_answered, comment_count')
    .eq('author_id', contributorId)
    .in('repository_id', repoIds);

  // Fetch discussion comments in workspace repositories
  const { data: discussionComments } = await supabase
    .from('discussion_comments')
    .select('id, discussions!inner(repository_id)')
    .eq('author_id', contributorId)
    .in('discussions.repository_id', repoIds);

  const metrics: DiscussionMetrics = {
    totalDiscussions: discussions?.length || 0,
    answered: discussions?.filter((d) => d.is_answered).length || 0,
    comments: discussionComments?.length || 0,
    reactionsReceived: 0, // TODO: Add when reactions are tracked
  };

  if (metrics.totalDiscussions === 0 && metrics.comments === 0) return 0;

  // Calculate score components
  const answerRate = metrics.totalDiscussions > 0 ? metrics.answered / metrics.totalDiscussions : 0;
  const commentActivity = Math.min(metrics.comments / 10, 1); // Cap at 10 comments for full score

  // Weight: 50% answer rate, 50% comment activity
  const score = answerRate * 50 + commentActivity * 50;

  return Math.round(score);
}

/**
 * Calculate code review depth score (0-100)
 * Measures the quality and thoroughness of code reviews
 */
async function calculateCodeReviewDepth(
  contributorId: string,
  workspaceId: string
): Promise<number> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) return 0;

  // Fetch review metrics
  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      `
      id,
      state,
      pull_requests!inner(repository_id)
    `
    )
    .eq('reviewer_id', contributorId)
    .in('pull_requests.repository_id', repoIds);

  // Fetch review comments
  const reviewIds = reviews?.map((r) => r.id) || [];
  const { data: reviewComments } = await supabase
    .from('review_comments')
    .select('id, review_id')
    .in('review_id', reviewIds);

  const metrics: CodeReviewMetrics = {
    totalReviews: reviews?.length || 0,
    approvals: reviews?.filter((r) => r.state === 'APPROVED').length || 0,
    changesRequested: reviews?.filter((r) => r.state === 'CHANGES_REQUESTED').length || 0,
    commentedReviews: reviews?.filter((r) => r.state === 'COMMENTED').length || 0,
    avgCommentsPerReview: 0,
  };

  if (metrics.totalReviews === 0) return 0;

  // Calculate average comments per review
  metrics.avgCommentsPerReview = (reviewComments?.length || 0) / metrics.totalReviews;

  // Calculate score components
  const reviewThoroughness = Math.min(metrics.avgCommentsPerReview / 5, 1); // Cap at 5 comments per review
  const reviewEngagement = Math.min(metrics.totalReviews / 20, 1); // Cap at 20 reviews for full score
  const criticalReviews =
    metrics.totalReviews > 0 ? metrics.changesRequested / metrics.totalReviews : 0;

  // Weight: 40% thoroughness, 30% engagement, 30% critical reviews
  const score = reviewThoroughness * 40 + reviewEngagement * 30 + criticalReviews * 30;

  return Math.round(score);
}

/**
 * Calculate issue quality score (0-100)
 * Measures the quality of issues created
 */
async function calculateIssueQuality(contributorId: string, workspaceId: string): Promise<number> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) return 0;

  // Fetch issue metrics
  const { data: issues } = await supabase
    .from('issues')
    .select('id, title, body, state')
    .eq('author_id', contributorId)
    .in('repository_id', repoIds);

  const metrics: IssueMetrics = {
    totalIssues: issues?.length || 0,
    closedIssues: issues?.filter((i) => i.state === 'closed').length || 0,
    issuesWithDetails: issues?.filter((i) => i.body && i.body.length > 100).length || 0,
    reactionsReceived: 0, // TODO: Add when reactions are tracked
  };

  if (metrics.totalIssues === 0) return 0;

  // Calculate score components
  const completionRate = metrics.closedIssues / metrics.totalIssues;
  const detailRate = metrics.issuesWithDetails / metrics.totalIssues;
  const issueVolume = Math.min(metrics.totalIssues / 10, 1); // Cap at 10 issues for full score

  // Weight: 40% detail rate, 30% completion rate, 30% volume
  const score = detailRate * 40 + completionRate * 30 + issueVolume * 30;

  return Math.round(score);
}

/**
 * Calculate mentor score (0-100)
 * Measures helping and mentoring behavior
 */
async function calculateMentorScore(contributorId: string, workspaceId: string): Promise<number> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) return 0;

  // Fetch mentor behavior indicators
  const [issueComments, discussionComments, prTitles] = await Promise.all([
    // Comments on others' issues
    supabase
      .from('comments')
      .select('id, issues!inner(author_id, repository_id)')
      .eq('commenter_id', contributorId)
      .neq('issues.author_id', contributorId)
      .in('issues.repository_id', repoIds),

    // Comments on others' discussions
    supabase
      .from('discussion_comments')
      .select('id, discussions!inner(author_id, repository_id)')
      .eq('author_id', contributorId)
      .neq('discussions.author_id', contributorId)
      .in('discussions.repository_id', repoIds),

    // PRs with documentation in title (docs, readme, guide, etc.)
    supabase
      .from('pull_requests')
      .select('title')
      .eq('author_id', contributorId)
      .in('repository_id', repoIds),
  ]);

  const docKeywords = ['doc', 'readme', 'guide', 'tutorial', 'example', 'contributing'];
  const documentationPRs =
    prTitles.data?.filter((pr) =>
      docKeywords.some((keyword) => pr.title.toLowerCase().includes(keyword))
    ).length || 0;

  const metrics: MentorMetrics = {
    helpfulComments: (issueComments.data?.length || 0) + (discussionComments.data?.length || 0),
    questionsAnswered: discussionComments.data?.length || 0,
    documentationContributions: documentationPRs,
  };

  // Calculate score components
  const helpfulness = Math.min(metrics.helpfulComments / 20, 1); // Cap at 20 helpful comments
  const mentorship = Math.min(metrics.questionsAnswered / 10, 1); // Cap at 10 answers
  const documentation = Math.min(metrics.documentationContributions / 5, 1); // Cap at 5 doc PRs

  // Weight: 50% helpfulness, 30% mentorship, 20% documentation
  const score = helpfulness * 50 + mentorship * 30 + documentation * 20;

  return Math.round(score);
}

/**
 * Calculate comprehensive quality score breakdown for a contributor
 */
export async function calculateQualityScore(
  contributorId: string,
  workspaceId: string
): Promise<QualityScoreBreakdown> {
  // Calculate all component scores in parallel
  const [discussionImpact, codeReviewDepth, issueQuality, mentorScore] = await Promise.all([
    calculateDiscussionImpact(contributorId, workspaceId),
    calculateCodeReviewDepth(contributorId, workspaceId),
    calculateIssueQuality(contributorId, workspaceId),
    calculateMentorScore(contributorId, workspaceId),
  ]);

  // Calculate weighted overall score
  const overall =
    discussionImpact * QUALITY_WEIGHTS.discussionImpact +
    codeReviewDepth * QUALITY_WEIGHTS.codeReviewDepth +
    issueQuality * QUALITY_WEIGHTS.issueQuality +
    mentorScore * QUALITY_WEIGHTS.mentorScore;

  return {
    overall: Math.round(overall),
    discussionImpact,
    codeReviewDepth,
    issueQuality,
    mentorScore,
    weights: QUALITY_WEIGHTS,
  };
}

/**
 * Update contributor quality scores in the database
 * This should be called by background jobs to keep scores fresh
 */
export async function updateContributorQualityScores(
  contributorId: string,
  workspaceId: string
): Promise<void> {
  try {
    // Calculate quality scores
    const qualityScore = await calculateQualityScore(contributorId, workspaceId);

    // Update contributors table
    const { error: updateError } = await supabase
      .from('contributors')
      .update({
        quality_score: qualityScore.overall,
        discussion_impact_score: qualityScore.discussionImpact,
        code_review_depth_score: qualityScore.codeReviewDepth,
        issue_quality_score: qualityScore.issueQuality,
        mentor_score: qualityScore.mentorScore,
      })
      .eq('id', contributorId);

    if (updateError) {
      console.error('Error updating contributor quality scores:', updateError);
      throw updateError;
    }

    // Also update contributor_analytics table with snapshot
    const { error: analyticsError } = await supabase.from('contributor_analytics').upsert(
      {
        contributor_id: contributorId,
        workspace_id: workspaceId,
        snapshot_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        quality_score: qualityScore.overall,
        discussion_impact_score: qualityScore.discussionImpact,
        code_review_depth_score: qualityScore.codeReviewDepth,
        issue_quality_score: qualityScore.issueQuality,
        mentor_score: qualityScore.mentorScore,
      },
      {
        onConflict: 'contributor_id,workspace_id,snapshot_date',
      }
    );

    if (analyticsError) {
      console.error('Error updating contributor analytics:', analyticsError);
      // Don't throw - main update succeeded
    }
  } catch (error) {
    console.error('Error in updateContributorQualityScores:', error);
    throw error;
  }
}
