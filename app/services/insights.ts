import { supabase } from '../../src/lib/supabase';
import { PullRequest, Repository } from '../types/github';

export interface ContributorInsights {
  login: string;
  name?: string;
  avatarUrl: string;
  totalPRs: number;
  mergedPRs: number;
  reviewsGiven: number;
  commentsLeft: number;
  firstTimeApprovalRate: number;
  expertise: string[];
  lastActive: string;
}

/**
 * Generate contributor insights for a PR author
 */
export async function generatePRInsights(
  pullRequest: PullRequest,
  repository: Repository
): Promise<ContributorInsights> {
  const authorLogin = pullRequest.user.login;

  try {
    // Get contributor data from database
    const { data: contributor } = await supabase
      .from('contributors')
      .select(
        `
        *,
        pull_requests (
          id,
          state,
          created_at,
          merged_at,
          reviews (
            state,
            submitted_at
          )
        ),
        reviews (
          id
        ),
        comments (
          id
        )
      `
      )
      .eq('github_login', authorLogin)
      .maybeSingle();

    if (!contributor) {
      // Return basic info if contributor not in database yet
      return {
        login: authorLogin,
        avatarUrl: pullRequest.user.avatar_url,
        totalPRs: 1,
        mergedPRs: 0,
        reviewsGiven: 0,
        commentsLeft: 0,
        firstTimeApprovalRate: 0,
        expertise: [],
        lastActive: 'Now',
      };
    }

    // Calculate metrics
    const prs = contributor.pull_requests || [];
    const mergedPRs = prs.filter((pr: any) => pr.merged_at).length;
    const totalPRs = prs.length;
    const reviewsGiven = contributor.reviews?.length || 0;
    const commentsLeft = contributor.comments?.length || 0;

    // Calculate first-time approval rate
    const prsWithReviews = prs.filter((pr: any) => pr.reviews?.length > 0);
    const firstTimeApprovals = prsWithReviews.filter((pr: any) => {
      const approvals = pr.reviews.filter((r: any) => r.state === 'APPROVED');
      const changes = pr.reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED');
      return approvals.length > 0 && changes.length === 0;
    }).length;

    const firstTimeApprovalRate =
      prsWithReviews.length > 0
        ? Math.round((firstTimeApprovals / prsWithReviews.length) * 100)
        : 0;

    // Get expertise from most touched files/areas
    const expertise = await getContributorExpertise(contributor.id);

    // Get last activity
    const lastActive = calculateLastActive(contributor.last_active_at);

    return {
      login: contributor.github_login,
      name: contributor.name,
      avatarUrl: contributor.avatar_url,
      totalPRs,
      mergedPRs,
      reviewsGiven,
      commentsLeft,
      firstTimeApprovalRate,
      expertise,
      lastActive,
    };
  } catch (error) {
    console.error('Error generating PR insights:', error);

    // Return basic info on error
    return {
      login: authorLogin,
      avatarUrl: pullRequest.user.avatar_url,
      totalPRs: 1,
      mergedPRs: 0,
      reviewsGiven: 0,
      commentsLeft: 0,
      firstTimeApprovalRate: 0,
      expertise: [],
      lastActive: 'Now',
    };
  }
}

/**
 * Get contributor's areas of expertise based on their contributions
 */
async function getContributorExpertise(contributorId: string): Promise<string[]> {
  try {
    // Get files the contributor has worked on
    const { data: fileContributions } = await supabase
      .from('file_contributors')
      .select('file_path')
      .eq('contributor_id', contributorId)
      .order('commit_count', { ascending: false })
      .limit(50);

    if (!fileContributions || fileContributions.length === 0) {
      return [];
    }

    // Analyze file paths to determine expertise
    const expertise = new Set<string>();

    for (const fc of fileContributions) {
      const path = fc.file_path.toLowerCase();

      // Frontend
      if (path.match(/\.(tsx?|jsx?|vue|svelte)$/)) {
        expertise.add('frontend');
      }

      // Backend/API
      if (path.includes('/api/') || path.includes('/server/') || path.match(/\.(py|rb|java|go)$/)) {
        expertise.add('backend');
      }

      // Database
      if (path.match(/\.(sql|migration)/) || path.includes('/migrations/')) {
        expertise.add('database');
      }

      // Testing
      if (
        path.match(/\b(test|spec)\b/) ||
        path.includes('__tests__') ||
        path.includes('.test.') ||
        path.includes('.spec.')
      ) {
        expertise.add('testing');
      }

      // DevOps
      if (path.match(/\.(yml|yaml)$/) || path.includes('.github/')) {
        expertise.add('devops');
      }

      // Documentation
      if (path.match(/\.(md|mdx|rst)$/)) {
        expertise.add('documentation');
      }
    }

    return Array.from(expertise).slice(0, 3);
  } catch (error) {
    console.error('Error getting contributor expertise:', error);
    return [];
  }
}

/**
 * Calculate how long ago the contributor was last active
 */
function calculateLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Now';

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}
