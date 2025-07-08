import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PullRequest, LotteryFactor, ContributorStats } from './types';

// Re-export mobile detection utilities
export {
  useIsMobile,
  getIsMobile,
  getIsMobileUserAgent,
  useIsMobileDetailed,
  useViewportSize,
  useNetworkAwareDetection
} from './utils/mobile-detection';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanizeNumber(num: number): string {
  if (num === 0) return "0";
  
  const units = ["", "K", "M", "B", "T"];
  const order = Math.floor(Math.log(Math.abs(num)) / Math.log(1000));
  const unitname = units[order];
  const value = Math.round(num / Math.pow(1000, order));
  return value + unitname;
}

export function calculateLotteryFactor(
  prs: PullRequest[], 
  timeRange: string = '30', 
  includeBots: boolean = false
): LotteryFactor {
  // Use the provided time range
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));
  
  // Filter by time range and optionally by bot status
  const recentPRs = prs.filter(pr => {
    const isRecent = new Date(pr.created_at) > daysAgo;
    const isBot = pr.user.type === 'Bot';
    
    // If includeBots is false, filter out bots
    if (!includeBots && isBot) {
      return false;
    }
    
    return isRecent;
  });

  // Count PRs per contributor and collect their recent PRs
  const contributorMap = new Map<string, ContributorStats>();
  
  recentPRs.forEach(pr => {
    const existing = contributorMap.get(pr.user.login);
    if (existing) {
      existing.pullRequests += 1;
      existing.recentPRs = existing.recentPRs || [];
      if (existing.recentPRs.length < 5) {
        existing.recentPRs.push(pr);
      }
      if (!existing.organizations && pr.organizations) {
        existing.organizations = pr.organizations;
      }
    } else {
      contributorMap.set(pr.user.login, {
        login: pr.user.login,
        avatar_url: pr.user.avatar_url,
        pullRequests: 1,
        percentage: 0,
        recentPRs: [pr],
        organizations: pr.organizations,
      });
    }
  });

  // Calculate percentages and sort by contribution count
  const totalPRs = recentPRs.length;
  const contributors = Array.from(contributorMap.values())
    .map(contributor => ({
      ...contributor,
      percentage: (contributor.pullRequests / totalPRs) * 100
    }))
    .sort((a, b) => b.pullRequests - a.pullRequests);

  // Take only the top 7 contributors
  const topContributors = contributors.slice(0, 7);

  // Calculate top 2 contributors' percentage (for risk level)
  const topTwoPercentage = contributors
    .slice(0, 2)
    .reduce((sum, contributor) => sum + contributor.percentage, 0);

  // Determine risk level
  let riskLevel: 'Low' | 'Medium' | 'High';
  if (topTwoPercentage >= 60) {
    riskLevel = 'High';
  } else if (topTwoPercentage >= 40) {
    riskLevel = 'Medium';
  } else {
    riskLevel = 'Low';
  }

  return {
    topContributorsCount: 2,
    totalContributors: contributors.length,
    topContributorsPercentage: Math.round(topTwoPercentage),
    contributors: topContributors,
    riskLevel
  };
}