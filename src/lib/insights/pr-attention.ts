import { fetchPullRequests } from '../github';

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
 * Detects PRs that need attention based on various criteria
 */
export async function detectPrAttention(
  owner: string,
  repo: string,
  timeRange: string = '90'
): Promise<{ alerts: PrAlert[]; metrics: PrAttentionMetrics }> {
  try {
    // Fetch open PRs
    const pullRequests = await fetchPullRequests(owner, repo, timeRange);
    
    const alerts: PrAlert[] = [];
    let totalDaysOpen = 0;
    
    for (const pr of pullRequests) {
      const createdAt = new Date(pr.created_at);
      const updatedAt = new Date(pr.updated_at);
      const now = new Date();
      
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceUpdated = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate PR size (simplified without GitHub API additions/deletions)
      const linesChanged = 100; // Default estimate
      const filesChanged = 5; // Default estimate
      
      let size: PrAlert["size"] = "small";
      if (linesChanged > 1000 || filesChanged > 20) size = "xl";
      else if (linesChanged > 500 || filesChanged > 10) size = "large";
      else if (linesChanged > 100 || filesChanged > 5) size = "medium";
      
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
      
      // First-time contributor detection (simplified)
      const isFirstTimeContributor = false;
      
      if (isFirstTimeContributor) {
        reasons.push("First-time contributor");
        urgencyScore += 15; // Boost for first-timers
      }
      
      // Review status (simplified)
      const reviewsRequested = 0;
      const reviewsReceived = 0; // Would need separate API call
      
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
    
  } catch (error) {
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
  } catch (error) {
    return 0;
  }
}