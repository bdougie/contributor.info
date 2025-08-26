import { fetchPRDataWithFallback } from '../supabase-pr-data';
import { supabase } from '../supabase';

export interface PrAlert {
  id: number;
  title: string;
  number: number;
  author: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  urgency: "critical" | "high" | "medium" | "low";
  urgencyScore: number; // 0-100
  reasons: string[];
  daysSinceCreated: number;
  daysSinceUpdated: number;
  reviewsRequested: number;
  reviewsReceived: number;
  isFirstTimeContributor: boolean;
  isDraft: boolean;
  size: "small" | "medium" | "large" | "xl";
  linesChanged: number;
  filesChanged: number;
  hasMaintainerComment: boolean;
  maintainerCommenters: string[];
  daysSinceLastMaintainerComment: number | null;
}

export interface PrAttentionMetrics {
  totalAlerts: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  oldestPr: PrAlert | null;
  averageDaysOpen: number;
}

/**
 * Fetches maintainers and owners for a repository based on confidence scores
 */
async function fetchMaintainers(owner: string, repo: string): Promise<Set<string>> {
  try {
    const { data, error: _error } = await supabase
      .from('contributor_roles')
      .select('user_id')
      .eq('repository_owner', owner)
      .eq('repository_name', repo)
      .in('role', ['owner', 'maintainer'])
      .gte('confidence_score', 0.7); // Minimum confidence threshold for maintainers

    if (_error) throw error;

    return new Set((_data || []).map(role => role.user_id));
  } catch (_error) {
    console.warn('Failed to fetch maintainers:', _error);
    return new Set();
  }
}

/**
 * Analyzes PR comments to determine maintainer engagement
 */
function analyzeMaintainerComments(
  comments: Array<{ user: { login: string }, created_at: string }>,
  reviews: Array<{ user: { login: string }, submitted_at: string }>,
  maintainers: Set<string>
): {
  hasMaintainerComment: boolean;
  maintainerCommenters: string[];
  daysSinceLastMaintainerComment: number | null;
} {
  const now = new Date();
  const allInteractions = [
    ...comments.map(c => ({ user: c.user.login, date: new Date(c.created_at) })),
    ...reviews.map(r => ({ user: r.user.login, date: new Date(r.submitted_at) }))
  ];

  const maintainerInteractions = allInteractions.filter(interaction => 
    maintainers.has(interaction.user)
  );

  if (maintainerInteractions.length === 0) {
    return {
      hasMaintainerComment: false,
      maintainerCommenters: [],
      daysSinceLastMaintainerComment: null
    };
  }

  const maintainerCommenters = [...new Set(maintainerInteractions.map(i => i.user))];
  const latestMaintainerInteraction = maintainerInteractions
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const daysSinceLastMaintainerComment = Math.floor(
    (now.getTime() - latestMaintainerInteraction.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    hasMaintainerComment: true,
    maintainerCommenters,
    daysSinceLastMaintainerComment
  };
}

/**
 * Detects PRs that need attention based on various criteria
 */
export async function detectPrAttention(
  owner: string,
  repo: string,
  timeRange: string = '90'
): Promise<{ alerts: PrAlert[]; metrics: PrAttentionMetrics }> {
  try {
    // Fetch open PRs and maintainers in parallel
    const [prDataResult, maintainers] = await Promise.all([
      fetchPRDataWithFallback(owner, repo, timeRange),
      fetchMaintainers(owner, repo)
    ]);

    const pullRequests = prDataResult.data;
    // Filter to only open PRs for attention analysis
    const openPRs = pullRequests.filter(pr => pr.state === 'open');
    
    const alerts: PrAlert[] = [];
    let totalDaysOpen = 0;
    
    for (const pr of openPRs) {
      // Skip PRs created by maintainers - they don't need attention from other maintainers
      const prAuthor = pr.user?.login;
      if (prAuthor && maintainers.has(prAuthor)) {
        continue;
      }

      const createdAt = new Date(pr.created_at);
      const updatedAt = new Date(pr.updated_at);
      const now = new Date();
      
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceUpdated = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate PR size using real data from GitHub API
      const linesChanged = (pr.additions || 0) + (pr.deletions || 0);
      const filesChanged = 5; // Default estimate - could be enhanced with file count API call
      
      let size: PrAlert["size"] = "small";
      if (linesChanged > 1000 || filesChanged > 20) size = "xl";
      else if (linesChanged > 500 || filesChanged > 10) size = "large";
      else if (linesChanged > 100 || filesChanged > 5) size = "medium";
      
      // Analyze maintainer engagement
      const maintainerAnalysis = analyzeMaintainerComments(
        pr.comments || [],
        pr.reviews || [],
        maintainers
      );

      // Gather alert reasons and calculate urgency
      const reasons: string[] = [];
      let urgencyScore = 0;
      
      // Age-based scoring
      if (daysSinceCreated >= 7) {
        reasons.push(`No activity for ${daysSinceCreated} days`);
        urgencyScore += Math.min(daysSinceCreated * 2, 40); // Max 40 points for age
      } else if (daysSinceCreated >= 3) {
        reasons.push(`Open for ${daysSinceCreated} days`);
        urgencyScore += daysSinceCreated * 5;
      }
      
      // Update-based scoring
      if (daysSinceUpdated >= 3) {
        reasons.push(`No updates for ${daysSinceUpdated} days`);
        urgencyScore += daysSinceUpdated * 3;
      }
      
      // Size-based scoring
      if (size === "xl") {
        reasons.push("Very large PR (1000+ lines)");
        urgencyScore += 20;
      } else if (size === "large") {
        reasons.push("Large PR (500+ lines)");
        urgencyScore += 15;
      }
      
      // Draft status (simplified)
      const isDraft = false;
      if (isDraft) {
        urgencyScore = Math.max(0, urgencyScore - 20); // Reduce urgency for drafts
      }
      
      // Maintainer attention analysis - this is the key enhancement
      if (!maintainerAnalysis.hasMaintainerComment) {
        if (daysSinceCreated >= 7) {
          reasons.push("No response in 7+ days");
          urgencyScore += 30; // High urgency for aged PRs without maintainer attention
        } else if (daysSinceCreated >= 3) {
          reasons.push("Needs response");
          urgencyScore += 20; // Medium urgency for PRs waiting for maintainer attention
        }
      } else if (maintainerAnalysis.daysSinceLastMaintainerComment !== null && 
                 maintainerAnalysis.daysSinceLastMaintainerComment >= 5) {
        reasons.push(`Last response ${maintainerAnalysis.daysSinceLastMaintainerComment} days ago`);
        urgencyScore += 15; // Boost for stale maintainer conversations
      }

      // First-time contributor detection (simplified)
      const isFirstTimeContributor = false;
      
      if (isFirstTimeContributor) {
        reasons.push("First-time contributor");
        urgencyScore += 15; // Boost for first-timers
      }
      
      // Review status using real data
      const reviewsRequested = 0; // Could be enhanced with review request API
      const reviewsReceived = (pr.reviews || []).length;
      
      if (reviewsRequested > 0 && daysSinceCreated >= 2) {
        reasons.push("Review requested but no response");
        urgencyScore += 10;
      }
      
      // Convert score to urgency level
      let urgency: PrAlert["urgency"] = "low";
      if (urgencyScore >= 70) urgency = "critical";
      else if (urgencyScore >= 50) urgency = "high";
      else if (urgencyScore >= 30) urgency = "medium";
      
      // Only include PRs that have some urgency (score > 20 or specific conditions)
      if (urgencyScore > 20 || daysSinceCreated >= 7 || 
          (isFirstTimeContributor && daysSinceCreated >= 2) ||
          size === "xl") {
        
        alerts.push({
          id: pr.id,
          title: pr.title,
          number: pr.number,
          author: pr.user?.login || 'unknown',
          url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
          createdAt,
          updatedAt,
          urgency,
          urgencyScore: Math.min(urgencyScore, 100),
          reasons: reasons.length > 0 ? reasons : ["Needs review"],
          daysSinceCreated,
          daysSinceUpdated,
          reviewsRequested,
          reviewsReceived,
          isFirstTimeContributor,
          isDraft,
          size,
          linesChanged,
          filesChanged,
          hasMaintainerComment: maintainerAnalysis.hasMaintainerComment,
          maintainerCommenters: maintainerAnalysis.maintainerCommenters,
          daysSinceLastMaintainerComment: maintainerAnalysis.daysSinceLastMaintainerComment,
        });
        
        totalDaysOpen += daysSinceCreated;
      }
    }
    
    // Sort by urgency score (highest first)
    alerts.sort((a, b) => b.urgencyScore - a.urgencyScore);
    
    // Calculate metrics
    const criticalCount = alerts.filter(a => a.urgency === "critical").length;
    const highCount = alerts.filter(a => a.urgency === "high").length;
    const mediumCount = alerts.filter(a => a.urgency === "medium").length;
    const lowCount = alerts.filter(a => a.urgency === "low").length;
    
    const oldestPr = alerts.reduce((oldest, current) => 
      !oldest || current.daysSinceCreated > oldest.daysSinceCreated ? current : oldest, 
      null as PrAlert | null
    );
    
    const averageDaysOpen = alerts.length > 0 ? totalDaysOpen / alerts.length : 0;
    
    const metrics: PrAttentionMetrics = {
      totalAlerts: alerts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      oldestPr,
      averageDaysOpen,
    };
    
    return { alerts: alerts.slice(0, 10), metrics }; // Limit to top 10 alerts
    
  } catch (_error) {
    console.error('Error detecting PR attention:', _error);
    return {
      alerts: [],
      metrics: {
        totalAlerts: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        oldestPr: null,
        averageDaysOpen: 0,
      }
    };
  }
}

/**
 * Quick check for critical PR alerts count only
 */
export async function getCriticalPrCount(
  owner: string,
  repo: string
): Promise<number> {
  try {
    const { metrics } = await detectPrAttention(owner, repo);
    return metrics.criticalCount + metrics.highCount;
  } catch (_error) {
    console.error('Error getting critical PR count:', _error);
    return 0;
  }
}