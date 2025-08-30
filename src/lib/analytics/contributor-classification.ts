import { PullRequest } from '@/lib/types';
import { ContributorClassification, ContributorType, ContributorTrustLevel } from '@/lib/types/advanced-analytics';

/**
 * Analyzes contributors to classify them as internal/external and assign trust levels
 * Critical for understanding community dynamics and succession planning
 */
export class ContributorClassificationAnalyzer {
  private static readonly COMPANY_DOMAINS = [
    'github.com', 'microsoft.com', 'google.com', 'meta.com', 'apple.com',
    'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com', 'shopify.com'
    // This should be configurable per organization
  ];

  private static readonly BUSINESS_HOURS_START = 9; // 9 AM
  private static readonly BUSINESS_HOURS_END = 17; // 5 PM

  /**
   * Classify a contributor based on their activity patterns and signals
   */
  static classifyContributor(
    login: string,
    pullRequests: PullRequest[],
    organizationMembers: string[] = [],
    knownEmployees: string[] = []
  ): ContributorClassification {
    const userPRs = pullRequests.filter(pr => 
      pr.user?.login?.toLowerCase() === login.toLowerCase() ||
      pr.author?.login?.toLowerCase() === login.toLowerCase()
    );

    const insiderSignals = this.analyzeInsiderSignals(login, userPRs, organizationMembers, knownEmployees);
    const contributorType = this.determineContributorType(insiderSignals);
    const trustIndicators = this.analyzeTrustIndicators(userPRs, pullRequests);
    const trustLevel = this.determineTrustLevel(trustIndicators, insiderSignals);
    const classificationConfidence = this.calculateClassificationConfidence(insiderSignals, trustIndicators);

    return {
      login,
      contributorType,
      trustLevel,
      classificationConfidence,
      insiderSignals,
      trustIndicators,
    };
  }

  /**
   * Analyze signals that indicate insider contributor status
   */
  private static analyzeInsiderSignals(
    login: string,
    userPRs: PullRequest[],
    organizationMembers: string[],
    knownEmployees: string[]
  ) {
    // Check organization membership
    const organizationMember = organizationMembers.includes(login.toLowerCase());
    
    // Check if they're in known employees list
    const knownEmployee = knownEmployees.includes(login.toLowerCase());

    // Analyze commit timing patterns
    const businessHourCommits = this.analyzeCommitTiming(userPRs);
    
    // Company email detection (simplified - in real implementation, would use more sophisticated detection)
    const hasCompanyEmail = this.detectCompanyEmail(login);
    
    // Employee git config detection (heuristic based on naming patterns)
    const employeeGitConfig = this.detectEmployeeGitConfig(userPRs);

    // Access to private repos (heuristic - PRs with internal references)
    const accessToPrivateRepos = this.detectPrivateRepoAccess(userPRs);

    return {
      hasCompanyEmail,
      commitsDuringBusinessHours: businessHourCommits,
      accessToPrivateRepos,
      organizationMember,
      employeeGitConfig,
    };
  }

  /**
   * Analyze trust-building indicators
   */
  private static analyzeTrustIndicators(userPRs: PullRequest[], allPRs: PullRequest[]) {
    const login = userPRs[0]?.user?.login || userPRs[0]?.author?.login || '';
    
    // Calculate months active
    const firstPR = userPRs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
    const monthsActive = firstPR ? 
      this.calculateMonthsBetween(new Date(firstPR.created_at), new Date()) : 0;

    // Code review participation
    const reviewParticipation = this.calculateReviewParticipation(login, allPRs);

    // Maintainer nominations (simplified - would need additional data source)
    const maintainerNominations = this.estimateMaintainerNominations(userPRs);

    // Security-sensitive commits (heuristic based on file patterns)
    const securitySensitiveCommits = this.countSecuritySensitiveCommits(userPRs);

    // Community reputation (simplified scoring)
    const communityReputation = this.calculateCommunityReputation(userPRs);

    return {
      monthsActive,
      codeReviewParticipation: reviewParticipation,
      maintainerNominations,
      securitySensitiveCommits,
      communityReputation,
    };
  }

  /**
   * Determine contributor type based on insider signals
   */
  private static determineContributorType(insiderSignals: any): ContributorType {
    let insiderScore = 0;

    if (insiderSignals.organizationMember) insiderScore += 3;
    if (insiderSignals.hasCompanyEmail) insiderScore += 2;
    if (insiderSignals.commitsDuringBusinessHours > 70) insiderScore += 2;
    if (insiderSignals.accessToPrivateRepos) insiderScore += 2;
    if (insiderSignals.employeeGitConfig) insiderScore += 1;

    if (insiderScore >= 6) return 'insider';
    if (insiderScore >= 3) return 'hybrid';
    return 'outsider';
  }

  /**
   * Determine trust level based on various indicators
   */
  private static determineTrustLevel(trustIndicators: any, insiderSignals: any): ContributorTrustLevel {
    let trustScore = 0;

    // Time-based trust
    if (trustIndicators.monthsActive >= 24) trustScore += 3;
    else if (trustIndicators.monthsActive >= 12) trustScore += 2;
    else if (trustIndicators.monthsActive >= 6) trustScore += 1;

    // Activity-based trust
    if (trustIndicators.codeReviewParticipation > 50) trustScore += 2;
    if (trustIndicators.communityReputation > 70) trustScore += 2;
    if (trustIndicators.securitySensitiveCommits > 5) trustScore += 2;
    if (trustIndicators.maintainerNominations > 0) trustScore += 3;

    // Insider status bonus
    if (insiderSignals.organizationMember) trustScore += 2;

    if (trustScore >= 10) return 'core';
    if (trustScore >= 7) return 'trusted';
    if (trustScore >= 4) return 'active';
    if (trustScore >= 1) return 'occasional';
    return 'new';
  }

  /**
   * Calculate confidence in the classification (0-1)
   */
  private static calculateClassificationConfidence(insiderSignals: any, trustIndicators: any): number {
    let confidence = 0.5; // Base confidence

    // Strong signals increase confidence
    if (insiderSignals.organizationMember) confidence += 0.3;
    if (insiderSignals.hasCompanyEmail) confidence += 0.2;
    if (trustIndicators.monthsActive > 6) confidence += 0.2;
    if (trustIndicators.codeReviewParticipation > 30) confidence += 0.1;

    // Conflicting signals reduce confidence
    if (insiderSignals.commitsDuringBusinessHours < 30 && insiderSignals.organizationMember) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Analyze commit timing to detect business hours pattern
   */
  private static analyzeCommitTiming(userPRs: PullRequest[]): number {
    let businessHourCommits = 0;
    let totalCommits = userPRs.length;

    userPRs.forEach(pr => {
      const commitHour = new Date(pr.created_at).getHours();
      if (commitHour >= this.BUSINESS_HOURS_START && commitHour < this.BUSINESS_HOURS_END) {
        businessHourCommits++;
      }
    });

    return totalCommits > 0 ? Math.round((businessHourCommits / totalCommits) * 100) : 0;
  }

  /**
   * Detect company email (simplified heuristic)
   */
  private static detectCompanyEmail(login: string): boolean {
    // In a real implementation, this would check commit author emails
    // For now, use heuristics based on username patterns
    return this.COMPANY_DOMAINS.some(domain => 
      login.toLowerCase().includes(domain.split('.')[0])
    );
  }

  /**
   * Detect employee git config patterns
   */
  private static detectEmployeeGitConfig(userPRs: PullRequest[]): boolean {
    // Heuristic: look for consistent naming patterns that suggest corporate setup
    // In reality, this would analyze commit author information
    return userPRs.length > 10 && userPRs.some(pr => 
      pr.user?.login?.includes('-') || pr.user?.login?.match(/^[a-z]+\.[a-z]+$/)
    );
  }

  /**
   * Detect access to private repositories
   */
  private static detectPrivateRepoAccess(userPRs: PullRequest[]): boolean {
    // Heuristic: PRs with certain patterns that suggest internal access
    return userPRs.some(pr => 
      pr.title?.toLowerCase().includes('internal') ||
      pr.title?.toLowerCase().includes('private') ||
      (pr.changed_files || 0) > 20 // Large changes might indicate internal access
    );
  }

  /**
   * Calculate code review participation rate
   */
  private static calculateReviewParticipation(login: string, allPRs: PullRequest[]): number {
    const reviewedPRs = allPRs.filter(pr => 
      pr.reviews?.some(review => 
        review.user?.login?.toLowerCase() === login.toLowerCase()
      ) || pr.comments?.some(comment =>
        comment.user?.login?.toLowerCase() === login.toLowerCase()
      )
    );

    return allPRs.length > 0 ? Math.round((reviewedPRs.length / allPRs.length) * 100) : 0;
  }

  /**
   * Estimate maintainer nominations based on activity patterns
   */
  private static estimateMaintainerNominations(userPRs: PullRequest[]): number {
    // Heuristic: high-impact PRs that affect core systems
    const highImpactPRs = userPRs.filter(pr =>
      (pr.changed_files || 0) > 10 &&
      (pr.additions || 0) + (pr.deletions || 0) > 500 &&
      pr.merged_at
    );

    return Math.floor(highImpactPRs.length / 10); // Rough estimate
  }

  /**
   * Count security-sensitive commits
   */
  private static countSecuritySensitiveCommits(userPRs: PullRequest[]): number {
    const securityKeywords = ['security', 'auth', 'password', 'token', 'crypto', 'ssl', 'tls'];
    
    return userPRs.filter(pr =>
      securityKeywords.some(keyword =>
        pr.title?.toLowerCase().includes(keyword) ||
        pr.body?.toLowerCase().includes(keyword)
      )
    ).length;
  }

  /**
   * Calculate community reputation score
   */
  private static calculateCommunityReputation(userPRs: PullRequest[]): number {
    let score = 0;

    // Base score from PR count
    score += Math.min(30, userPRs.length);

    // Bonus for merged PRs
    const mergedPRs = userPRs.filter(pr => pr.merged_at).length;
    score += Math.min(30, mergedPRs);

    // Bonus for PRs with positive reviews
    const positivelyReviewedPRs = userPRs.filter(pr =>
      pr.reviews?.some(review => review.state === 'APPROVED')
    ).length;
    score += Math.min(20, positivelyReviewedPRs);

    // Bonus for community interaction
    const discussedPRs = userPRs.filter(pr =>
      (pr.comments?.length || 0) > 2
    ).length;
    score += Math.min(20, discussedPRs);

    return Math.min(100, score);
  }

  /**
   * Calculate months between two dates
   */
  private static calculateMonthsBetween(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }
}

/**
 * Batch classify contributors
 */
export function classifyContributors(
  contributors: string[],
  pullRequests: PullRequest[],
  organizationMembers: string[] = [],
  knownEmployees: string[] = []
): ContributorClassification[] {
  return contributors.map(login =>
    ContributorClassificationAnalyzer.classifyContributor(
      login,
      pullRequests,
      organizationMembers,
      knownEmployees
    )
  );
}

/**
 * Get contributor breakdown by type
 */
export function getContributorBreakdown(
  contributors: string[],
  pullRequests: PullRequest[],
  organizationMembers: string[] = [],
  knownEmployees: string[] = []
): {
  insider: ContributorClassification[];
  outsider: ContributorClassification[];
  hybrid: ContributorClassification[];
  byTrustLevel: { [key in ContributorTrustLevel]: ContributorClassification[] };
} {
  const classifications = classifyContributors(contributors, pullRequests, organizationMembers, knownEmployees);
  
  const breakdown = {
    insider: classifications.filter(c => c.contributorType === 'insider'),
    outsider: classifications.filter(c => c.contributorType === 'outsider'),
    hybrid: classifications.filter(c => c.contributorType === 'hybrid'),
    byTrustLevel: {
      core: classifications.filter(c => c.trustLevel === 'core'),
      trusted: classifications.filter(c => c.trustLevel === 'trusted'),
      active: classifications.filter(c => c.trustLevel === 'active'),
      occasional: classifications.filter(c => c.trustLevel === 'occasional'),
      new: classifications.filter(c => c.trustLevel === 'new'),
    },
  };

  return breakdown;
}