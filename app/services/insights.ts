import { supabase } from '../../src/lib/supabase';
import { PullRequest, Repository } from '../types/github';

export interface ContributorInsights {
  login: string;
  name?: string;
  avatarUrl: string;
  totalPRs: number;
  mergedPRs: number;
  firstTimeApprovalRate: number;
  expertise: string[];
  activeHours: string;
  lastActive: string;
  repositories: number;
  totalContributions: number;
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
      .select(`
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
        )
      `)
      .eq('github_login', authorLogin)
      .single();

    if (!contributor) {
      // Return basic info if contributor not in database yet
      return {
        login: authorLogin,
        avatarUrl: pullRequest.user.avatar_url,
        totalPRs: 1,
        mergedPRs: 0,
        firstTimeApprovalRate: 0,
        expertise: [],
        activeHours: 'Unknown',
        lastActive: 'Now',
        repositories: 1,
        totalContributions: 1,
      };
    }

    // Calculate metrics
    const prs = contributor.pull_requests || [];
    const mergedPRs = prs.filter((pr: any) => pr.merged_at).length;
    const totalPRs = prs.length;

    // Calculate first-time approval rate
    const prsWithReviews = prs.filter((pr: any) => pr.reviews?.length > 0);
    const firstTimeApprovals = prsWithReviews.filter((pr: any) => {
      const approvals = pr.reviews.filter((r: any) => r.state === 'APPROVED');
      const changes = pr.reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED');
      return approvals.length > 0 && changes.length === 0;
    }).length;

    const firstTimeApprovalRate = prsWithReviews.length > 0 
      ? Math.round((firstTimeApprovals / prsWithReviews.length) * 100)
      : 0;

    // Get expertise from most touched files/areas
    const expertise = await getContributorExpertise(contributor.id);

    // Calculate active hours from PR creation times
    const activeHours = calculateActiveHours(prs);

    // Get last activity
    const lastActive = calculateLastActive(contributor.last_active_at);

    // Count unique repositories
    const { count: repoCount } = await supabase
      .from('pull_requests')
      .select('repository_id', { count: 'exact', head: true })
      .eq('contributor_id', contributor.id);

    return {
      login: contributor.github_login,
      name: contributor.name,
      avatarUrl: contributor.avatar_url,
      totalPRs,
      mergedPRs,
      firstTimeApprovalRate,
      expertise,
      activeHours,
      lastActive,
      repositories: repoCount || 1,
      totalContributions: contributor.total_contributions || totalPRs,
    };

  } catch (error) {
    console.error('Error generating PR insights:', error);
    
    // Return basic info on error
    return {
      login: authorLogin,
      avatarUrl: pullRequest.user.avatar_url,
      totalPRs: 1,
      mergedPRs: 0,
      firstTimeApprovalRate: 0,
      expertise: [],
      activeHours: 'Unknown',
      lastActive: 'Now',
      repositories: 1,
      totalContributions: 1,
    };
  }
}

/**
 * Get contributor's areas of expertise based on their contributions
 */
async function getContributorExpertise(contributorId: string): Promise<string[]> {
  // This would analyze the files they've touched, languages used, etc.
  // For now, return mock data
  const expertiseAreas = [
    'frontend',
    'backend',
    'API',
    'auth',
    'database',
    'DevOps',
    'testing',
    'documentation',
  ];

  // Use Fisher-Yates shuffle for proper randomization
  const shuffled = [...expertiseAreas];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

/**
 * Calculate active hours from PR creation times
 */
function calculateActiveHours(prs: any[]): string {
  if (prs.length === 0) return 'Unknown';

  // Analyze PR creation times to find patterns
  const hours = prs
    .filter(pr => pr.created_at)
    .map(pr => {
      const date = new Date(pr.created_at);
      return isNaN(date.getTime()) ? null : date.getHours();
    })
    .filter(hour => hour !== null) as number[];
  
  if (hours.length === 0) return 'Unknown';
  
  // Find most common hour range
  const hourCounts = new Map<number, number>();
  hours.forEach(hour => {
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  // Find peak hours
  let maxCount = 0;
  let peakHour = 9;
  hourCounts.forEach((count, hour) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = hour;
    }
  });

  // Format as range
  const startHour = Math.max(0, peakHour - 4);
  const endHour = Math.min(23, peakHour + 4);
  
  return `${formatHour(startHour)}-${formatHour(endHour)} UTC`;
}

/**
 * Format hour as 12-hour time
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
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