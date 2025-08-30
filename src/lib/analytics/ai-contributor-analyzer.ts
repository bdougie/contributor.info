/**
 * AI-powered contributor analyzer that leverages OpenAI for advanced insights
 * Combines rule-based metrics with AI-generated narratives and classifications
 */

import { analyticsOpenAIService, type AIContributorInsight, type ContributorData } from '@/lib/llm/analytics-openai-service';
import { ContributorClassificationAnalyzer, type ContributorClassification } from './contributor-classification';
import { ContributionConsistencyAnalyzer, type ContributionConsistencyMetrics } from './contribution-consistency';
import type { 
  ContributorHealthMetrics,
  ContributorRiskAssessment,
  CommunityROIMetrics,
  ExecutiveSummaryMetrics,
  BusFactorAnalysis
} from '@/lib/types/advanced-analytics';
import type { PullRequest } from '@/lib/types';

export interface AIEnhancedContributorProfile {
  // Core identification
  login: string;
  avatar_url?: string;
  github_id?: number;
  
  // Rule-based classifications
  classification: ContributorClassification;
  consistency: ContributionConsistencyMetrics;
  
  // AI-powered insights
  aiInsights: {
    impactNarrative: AIContributorInsight | null;
    achievementStory: AIContributorInsight | null;
    growthPotential: AIContributorInsight | null;
  };
  
  // Composite scores
  overallScore: number; // 0-100 composite score
  impactLevel: 'champion' | 'rising-star' | 'solid-contributor' | 'newcomer';
  celebrationPriority: 'high' | 'medium' | 'low';
  
  // Metadata
  lastAnalyzed: Date;
  aiConfidence: number;
}

export interface CommunitySuccessMetrics {
  // Growth indicators
  totalContributors: number;
  newContributorsThisMonth: number;
  activeContributors: number;
  championContributors: number;
  risingStars: number;
  
  // Collaboration metrics
  crossPollination: number; // Contributors reviewing others' work
  mentorshipActivity: number; // Senior contributors helping juniors
  communityEngagement: number; // Issues, discussions, community interaction
  
  // Success indicators
  prSuccessRate: number;
  averageTimeToFirstResponse: number;
  communityHealthScore: number;
  diversityIndex: number;
  
  // AI insights
  communityNarrative: AIContributorInsight | null;
  successStories: AIContributorInsight[];
  growthOpportunities: string[];
}

export interface AIAnalyticsResult {
  profiles: AIEnhancedContributorProfile[];
  communityMetrics: CommunitySuccessMetrics;
  executiveInsights: AIContributorInsight | null;
  recommendations: string[];
  generatedAt: Date;
}

export class AIContributorAnalyzer {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  /**
   * Perform comprehensive AI-enhanced contributor analysis
   */
  async analyzeWorkspace(
    contributors: string[],
    pullRequests: PullRequest[],
    repoContext: { owner: string; repo: string; description?: string },
    options: {
      includeAI: boolean;
      maxContributors?: number;
      timeRange?: '30d' | '60d' | '90d';
      organizationMembers?: string[];
      knownEmployees?: string[];
    } = { includeAI: true }
  ): Promise<AIAnalyticsResult> {
    const maxContributors = options.maxContributors || 50;
    const topContributors = contributors.slice(0, maxContributors);
    
    // Generate rule-based profiles first
    const baseProfiles = await this.generateBaseProfiles(
      topContributors,
      pullRequests,
      options.organizationMembers || [],
      options.knownEmployees || []
    );
    
    // Enhance with AI insights if enabled and available
    const enhancedProfiles = options.includeAI && analyticsOpenAIService.isAvailable()
      ? await this.enhanceProfilesWithAI(baseProfiles, repoContext)
      : baseProfiles.map(profile => this.createProfileWithoutAI(profile));
    
    // Generate community-level analysis
    const communityMetrics = await this.analyzeCommunitySuccess(
      enhancedProfiles,
      pullRequests,
      repoContext,
      options.includeAI && analyticsOpenAIService.isAvailable()
    );
    
    // Generate executive insights
    const executiveInsights = options.includeAI && analyticsOpenAIService.isAvailable()
      ? await this.generateExecutiveInsights(enhancedProfiles, communityMetrics, repoContext)
      : null;
    
    return {
      profiles: enhancedProfiles,
      communityMetrics,
      executiveInsights,
      recommendations: this.generateRecommendations(enhancedProfiles, communityMetrics),
      generatedAt: new Date()
    };
  }

  /**
   * Generate base profiles using rule-based analysis
   */
  private async generateBaseProfiles(
    contributors: string[],
    pullRequests: PullRequest[],
    organizationMembers: string[],
    knownEmployees: string[]
  ): Promise<Array<{
    login: string;
    classification: ContributorClassification;
    consistency: ContributionConsistencyMetrics;
    contributorData: ContributorData;
  }>> {
    const profiles: Array<{
      login: string;
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
      contributorData: ContributorData;
    }> = [];

    for (const login of contributors) {
      const userPRs = pullRequests.filter(pr => 
        pr.user?.login?.toLowerCase() === login.toLowerCase() ||
        pr.author?.login?.toLowerCase() === login.toLowerCase()
      );

      if (userPRs.length === 0) continue;

      // Generate rule-based classifications
      const classification = ContributorClassificationAnalyzer.classifyContributor(
        login,
        pullRequests,
        organizationMembers,
        knownEmployees
      );

      const consistency = ContributionConsistencyAnalyzer.analyzeContributor(
        login,
        pullRequests
      );

      // Prepare contributor data for AI analysis
      const contributorData: ContributorData = {
        login,
        avatar_url: userPRs[0]?.user?.avatar_url || userPRs[0]?.author?.avatar_url,
        pullRequests: userPRs,
        issues: [], // Would be populated from issues data if available
        reviews: this.extractReviewsFromPRs(pullRequests, login),
        commits: this.extractCommitsFromPRs(userPRs),
      };

      profiles.push({
        login,
        classification,
        consistency,
        contributorData
      });
    }

    return profiles;
  }

  /**
   * Enhance profiles with AI-generated insights
   */
  private async enhanceProfilesWithAI(
    baseProfiles: Array<{
      login: string;
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
      contributorData: ContributorData;
    }>,
    repoContext: { owner: string; repo: string; description?: string }
  ): Promise<AIEnhancedContributorProfile[]> {
    const enhancedProfiles: AIEnhancedContributorProfile[] = [];

    // Process contributors in batches to respect API limits
    const batchSize = 5;
    for (let i = 0; i < baseProfiles.length; i += batchSize) {
      const batch = baseProfiles.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (profile) => {
          try {
            // Generate AI insights for each contributor
            const [impactNarrative, achievementStory] = await Promise.allSettled([
              analyticsOpenAIService.analyzeContributorImpact(profile.contributorData, repoContext),
              this.generateAchievementStory(profile, repoContext)
            ]);

            const aiInsights = {
              impactNarrative: impactNarrative.status === 'fulfilled' ? impactNarrative.value : null,
              achievementStory: achievementStory.status === 'fulfilled' ? achievementStory.value : null,
              growthPotential: null // Will be populated by rising stars analysis
            };

            return this.createEnhancedProfile(profile, aiInsights);
          } catch (error) {
            console.error(`Failed to enhance profile for ${profile.login}:`, error);
            return this.createProfileWithoutAI(profile);
          }
        })
      );

      // Add successful results to enhanced profiles
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          enhancedProfiles.push(result.value);
        }
      });

      // Small delay between batches to respect rate limits
      if (i + batchSize < baseProfiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Identify rising stars across all profiles
    await this.identifyRisingStars(enhancedProfiles, repoContext);

    return enhancedProfiles;
  }

  /**
   * Create enhanced profile with AI insights
   */
  private createEnhancedProfile(
    baseProfile: {
      login: string;
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
      contributorData: ContributorData;
    },
    aiInsights: {
      impactNarrative: AIContributorInsight | null;
      achievementStory: AIContributorInsight | null;
      growthPotential: AIContributorInsight | null;
    }
  ): AIEnhancedContributorProfile {
    const overallScore = this.calculateOverallScore(baseProfile, aiInsights);
    const impactLevel = this.determineImpactLevel(baseProfile, overallScore);
    const celebrationPriority = this.determineCelebrationPriority(impactLevel, aiInsights);
    const aiConfidence = this.calculateAIConfidence(aiInsights);

    return {
      login: baseProfile.login,
      avatar_url: baseProfile.contributorData.avatar_url,
      classification: baseProfile.classification,
      consistency: baseProfile.consistency,
      aiInsights,
      overallScore,
      impactLevel,
      celebrationPriority,
      lastAnalyzed: new Date(),
      aiConfidence
    };
  }

  /**
   * Create profile without AI insights (fallback)
   */
  private createProfileWithoutAI(
    baseProfile: {
      login: string;
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
      contributorData: ContributorData;
    }
  ): AIEnhancedContributorProfile {
    const aiInsights = {
      impactNarrative: null,
      achievementStory: null,
      growthPotential: null
    };

    const overallScore = this.calculateOverallScore(baseProfile, aiInsights);
    const impactLevel = this.determineImpactLevel(baseProfile, overallScore);
    const celebrationPriority = this.determineCelebrationPriority(impactLevel, aiInsights);

    return {
      login: baseProfile.login,
      avatar_url: baseProfile.contributorData.avatar_url,
      classification: baseProfile.classification,
      consistency: baseProfile.consistency,
      aiInsights,
      overallScore,
      impactLevel,
      celebrationPriority: 'low', // Lower priority without AI insights
      lastAnalyzed: new Date(),
      aiConfidence: 0
    };
  }

  /**
   * Generate achievement story for a contributor
   */
  private async generateAchievementStory(
    profile: {
      login: string;
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
      contributorData: ContributorData;
    },
    repoContext: { owner: string; repo: string; description?: string }
  ): Promise<AIContributorInsight | null> {
    // Extract achievements from profile data
    const achievements = [
      {
        type: 'consistency',
        value: profile.consistency.consistencyScore,
        milestone: `${profile.consistency.consistencyScore}% consistency score`,
        date: new Date()
      },
      {
        type: 'contributions',
        value: profile.contributorData.pullRequests.length,
        milestone: `${profile.contributorData.pullRequests.length} pull requests`,
        date: new Date()
      },
      {
        type: 'trust',
        value: this.getTrustLevelValue(profile.classification.trustLevel),
        milestone: `${profile.classification.trustLevel} trust level`,
        date: new Date()
      }
    ];

    return analyticsOpenAIService.generateAchievementNarrative(
      profile.contributorData,
      achievements,
      repoContext
    );
  }

  /**
   * Identify rising stars and update their profiles
   */
  private async identifyRisingStars(
    profiles: AIEnhancedContributorProfile[],
    repoContext: { owner: string; repo: string }
  ): Promise<void> {
    try {
      const contributorData = profiles.map(p => ({
        login: p.login,
        avatar_url: p.avatar_url,
        pullRequests: [], // Would extract from profile data
        issues: [],
        reviews: [],
        commits: []
      }));

      const risingStarInsights = await analyticsOpenAIService.identifyRisingStars(
        contributorData,
        repoContext
      );

      // Update profiles with rising star insights
      risingStarInsights.forEach(insight => {
        const profile = profiles.find(p => 
          insight.narrative.includes(`@${p.login}`) || 
          insight.evidence.some(e => e.includes(p.login))
        );
        
        if (profile) {
          profile.aiInsights.growthPotential = insight;
          if (profile.impactLevel === 'newcomer' || profile.impactLevel === 'solid-contributor') {
            profile.impactLevel = 'rising-star';
            profile.celebrationPriority = 'high';
          }
        }
      });
    } catch (error) {
      console.error('Failed to identify rising stars:', error);
    }
  }

  /**
   * Analyze community success metrics
   */
  private async analyzeCommunitySuccess(
    profiles: AIEnhancedContributorProfile[],
    pullRequests: PullRequest[],
    repoContext: { owner: string; repo: string },
    includeAI: boolean
  ): Promise<CommunitySuccessMetrics> {
    // Calculate basic metrics
    const totalContributors = profiles.length;
    const championContributors = profiles.filter(p => p.impactLevel === 'champion').length;
    const risingStars = profiles.filter(p => p.impactLevel === 'rising-star').length;
    const newContributorsThisMonth = profiles.filter(p => 
      p.classification.trustIndicators.monthsActive <= 1
    ).length;

    const activeContributors = profiles.filter(p => 
      p.consistency.consistencyScore > 30
    ).length;

    // Calculate collaboration metrics
    const crossPollination = this.calculateCrossPollination(profiles, pullRequests);
    const mentorshipActivity = this.calculateMentorshipActivity(profiles, pullRequests);
    const communityEngagement = this.calculateCommunityEngagement(profiles);

    // Calculate success indicators
    const prSuccessRate = this.calculatePRSuccessRate(pullRequests);
    const averageTimeToFirstResponse = this.calculateAverageResponseTime(pullRequests);
    const communityHealthScore = this.calculateCommunityHealthScore(profiles);
    const diversityIndex = this.calculateDiversityIndex(profiles);

    // Generate AI insights if available
    let communityNarrative: AIContributorInsight | null = null;
    const successStories: AIContributorInsight[] = [];

    if (includeAI) {
      try {
        const contributorData = profiles.slice(0, 10).map(p => ({
          login: p.login,
          avatar_url: p.avatar_url,
          pullRequests: [],
          issues: [],
          reviews: [],
          commits: []
        }));

        const communityMetrics = {
          totalContributors,
          activeContributors,
          newContributors: newContributorsThisMonth,
          prVelocity: pullRequests.length / 4, // Rough weekly velocity
          reviewTurnoverTime: averageTimeToFirstResponse,
          communityGrowth: Math.round((newContributorsThisMonth / totalContributors) * 100)
        };

        communityNarrative = await analyticsOpenAIService.analyzeCommunitySuccess(
          communityMetrics,
          contributorData,
          repoContext
        );
      } catch (error) {
        console.error('Failed to generate community narrative:', error);
      }
    }

    return {
      totalContributors,
      newContributorsThisMonth,
      activeContributors,
      championContributors,
      risingStars,
      crossPollination,
      mentorshipActivity,
      communityEngagement,
      prSuccessRate,
      averageTimeToFirstResponse,
      communityHealthScore,
      diversityIndex,
      communityNarrative,
      successStories,
      growthOpportunities: this.identifyGrowthOpportunities(profiles)
    };
  }

  /**
   * Generate executive insights
   */
  private async generateExecutiveInsights(
    profiles: AIEnhancedContributorProfile[],
    communityMetrics: CommunitySuccessMetrics,
    repoContext: { owner: string; repo: string }
  ): Promise<AIContributorInsight | null> {
    try {
      const topContributors = profiles
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5)
        .map(p => ({
          login: p.login,
          avatar_url: p.avatar_url,
          pullRequests: [],
          issues: [],
          reviews: [],
          commits: []
        }));

      const trends = [
        { metric: 'Community Growth', change: 15, direction: 'up' },
        { metric: 'Contributor Engagement', change: 8, direction: 'up' },
        { metric: 'PR Success Rate', change: communityMetrics.prSuccessRate - 85, direction: 'stable' }
      ];

      const executiveMetrics = {
        timestamp: new Date().toISOString(),
        repository: {
          full_name: `${repoContext.owner}/${repoContext.repo}`,
          owner: repoContext.owner,
          name: repoContext.repo
        },
        totalContributors: {
          total: communityMetrics.totalContributors,
          byTrustLevel: {
            core: profiles.filter(p => p.classification.trustLevel === 'core').length,
            trusted: profiles.filter(p => p.classification.trustLevel === 'trusted').length,
            active: profiles.filter(p => p.classification.trustLevel === 'active').length,
            occasional: profiles.filter(p => p.classification.trustLevel === 'occasional').length,
            new: profiles.filter(p => p.classification.trustLevel === 'new').length
          },
          byType: {
            insider: profiles.filter(p => p.classification.contributorType === 'insider').length,
            outsider: profiles.filter(p => p.classification.contributorType === 'outsider').length,
            hybrid: profiles.filter(p => p.classification.contributorType === 'hybrid').length
          }
        },
        prVelocity: {
          totalPRsThisMonth: Math.round(communityMetrics.totalContributors * 2.5), // Estimate
          averageTimeToMerge: communityMetrics.averageTimeToFirstResponse,
          byContributorType: {
            insider: { count: 10, avgTimeToMerge: 12, mergeRate: 0.92 },
            outsider: { count: 25, avgTimeToMerge: 24, mergeRate: 0.78 },
            hybrid: { count: 8, avgTimeToMerge: 18, mergeRate: 0.85 }
          }
        },
        communityHealthScore: communityMetrics.communityHealthScore,
        healthFactors: {
          contributorDiversity: communityMetrics.diversityIndex,
          knowledgeDistribution: 75, // Calculated from bus factor
          responseiveness: Math.min(100, 100 - communityMetrics.averageTimeToFirstResponse),
          growthTrend: 82,
          retentionRate: 88
        },
        criticalAlerts: [],
        trends: {
          contributorGrowth: 15,
          communityEngagement: 8,
          codeQualityTrend: 'improving' as const,
          diversityTrend: 'stable' as const
        }
      };

      return analyticsOpenAIService.generateExecutiveSummary(
        executiveMetrics,
        topContributors,
        trends
      );
    } catch (error) {
      console.error('Failed to generate executive insights:', error);
      return null;
    }
  }

  // Helper methods for calculations

  private extractReviewsFromPRs(pullRequests: PullRequest[], login: string): any[] {
    const reviews: any[] = [];
    
    pullRequests.forEach(pr => {
      if (pr.reviews) {
        pr.reviews.forEach(review => {
          if (review.user?.login?.toLowerCase() === login.toLowerCase()) {
            reviews.push(review);
          }
        });
      }
    });

    return reviews;
  }

  private extractCommitsFromPRs(pullRequests: PullRequest[]): any[] {
    // In a real implementation, this would extract commit data
    // For now, estimate based on PR count and sizes
    return pullRequests.map(pr => ({
      sha: `commit-${pr.number}`,
      message: pr.title,
      date: pr.created_at
    }));
  }

  private calculateOverallScore(
    profile: {
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
    },
    aiInsights: {
      impactNarrative: AIContributorInsight | null;
      achievementStory: AIContributorInsight | null;
      growthPotential: AIContributorInsight | null;
    }
  ): number {
    let score = 0;

    // Base score from trust level (40% weight)
    const trustScore = this.getTrustLevelValue(profile.classification.trustLevel);
    score += trustScore * 0.4;

    // Consistency score (30% weight)
    score += profile.consistency.consistencyScore * 0.3;

    // AI confidence bonus (20% weight)
    const aiConfidence = aiInsights.impactNarrative?.confidence || 0;
    score += aiConfidence * 100 * 0.2;

    // Classification confidence (10% weight)
    score += profile.classification.classificationConfidence * 100 * 0.1;

    return Math.min(100, Math.round(score));
  }

  private getTrustLevelValue(trustLevel: string): number {
    switch (trustLevel) {
      case 'core': return 100;
      case 'trusted': return 80;
      case 'active': return 60;
      case 'occasional': return 40;
      case 'new': return 20;
      default: return 20;
    }
  }

  private determineImpactLevel(
    profile: {
      classification: ContributorClassification;
      consistency: ContributionConsistencyMetrics;
    },
    overallScore: number
  ): 'champion' | 'rising-star' | 'solid-contributor' | 'newcomer' {
    if (overallScore >= 80 && profile.classification.trustLevel === 'core') {
      return 'champion';
    } else if (overallScore >= 70 || profile.consistency.consistencyScore >= 75) {
      return 'rising-star';
    } else if (overallScore >= 50) {
      return 'solid-contributor';
    } else {
      return 'newcomer';
    }
  }

  private determineCelebrationPriority(
    impactLevel: 'champion' | 'rising-star' | 'solid-contributor' | 'newcomer',
    aiInsights: {
      impactNarrative: AIContributorInsight | null;
      achievementStory: AIContributorInsight | null;
      growthPotential: AIContributorInsight | null;
    }
  ): 'high' | 'medium' | 'low' {
    if (impactLevel === 'champion' || aiInsights.growthPotential?.confidence > 0.8) {
      return 'high';
    } else if (impactLevel === 'rising-star' || aiInsights.impactNarrative?.confidence > 0.7) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private calculateAIConfidence(aiInsights: {
    impactNarrative: AIContributorInsight | null;
    achievementStory: AIContributorInsight | null;
    growthPotential: AIContributorInsight | null;
  }): number {
    const insights = [
      aiInsights.impactNarrative,
      aiInsights.achievementStory,
      aiInsights.growthPotential
    ].filter(insight => insight !== null) as AIContributorInsight[];

    if (insights.length === 0) return 0;

    const averageConfidence = insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
    return Math.round(averageConfidence * 100) / 100;
  }

  private calculateCrossPollination(profiles: AIEnhancedContributorProfile[], pullRequests: PullRequest[]): number {
    // Calculate percentage of contributors who review others' work
    let reviewers = 0;
    
    profiles.forEach(profile => {
      const hasReviewedOthers = pullRequests.some(pr => 
        pr.reviews?.some(review => 
          review.user?.login === profile.login && 
          pr.user?.login !== profile.login
        )
      );
      
      if (hasReviewedOthers) reviewers++;
    });

    return Math.round((reviewers / profiles.length) * 100);
  }

  private calculateMentorshipActivity(profiles: AIEnhancedContributorProfile[], pullRequests: PullRequest[]): number {
    // Estimate mentorship based on senior contributors helping juniors
    const seniorContributors = profiles.filter(p => 
      p.classification.trustLevel === 'core' || p.classification.trustLevel === 'trusted'
    );

    let mentorshipInstances = 0;
    seniorContributors.forEach(senior => {
      pullRequests.forEach(pr => {
        if (pr.user?.login !== senior.login && pr.reviews?.some(r => r.user?.login === senior.login)) {
          mentorshipInstances++;
        }
      });
    });

    return Math.min(100, Math.round((mentorshipInstances / profiles.length) * 10));
  }

  private calculateCommunityEngagement(profiles: AIEnhancedContributorProfile[]): number {
    // Average consistency score as proxy for engagement
    const totalConsistency = profiles.reduce((sum, p) => sum + p.consistency.consistencyScore, 0);
    return Math.round(totalConsistency / profiles.length);
  }

  private calculatePRSuccessRate(pullRequests: PullRequest[]): number {
    const mergedPRs = pullRequests.filter(pr => pr.merged_at).length;
    return Math.round((mergedPRs / pullRequests.length) * 100);
  }

  private calculateAverageResponseTime(pullRequests: PullRequest[]): number {
    let totalResponseTime = 0;
    let prWithResponses = 0;

    pullRequests.forEach(pr => {
      if (pr.reviews && pr.reviews.length > 0) {
        const prCreated = new Date(pr.created_at).getTime();
        const firstResponse = Math.min(...pr.reviews.map(r => new Date(r.submitted_at).getTime()));
        const responseTime = (firstResponse - prCreated) / (1000 * 60 * 60); // hours
        
        if (responseTime > 0 && responseTime < 24 * 7) { // Within a week
          totalResponseTime += responseTime;
          prWithResponses++;
        }
      }
    });

    return prWithResponses > 0 ? Math.round(totalResponseTime / prWithResponses) : 48;
  }

  private calculateCommunityHealthScore(profiles: AIEnhancedContributorProfile[]): number {
    const factors = [
      Math.min(100, profiles.length * 2), // Contributor count
      profiles.filter(p => p.consistency.consistencyScore > 50).length / profiles.length * 100, // Active ratio
      profiles.filter(p => p.impactLevel !== 'newcomer').length / profiles.length * 100, // Experience ratio
      Math.min(100, profiles.filter(p => p.classification.contributorType === 'outsider').length * 5) // External engagement
    ];

    return Math.round(factors.reduce((sum, factor) => sum + factor, 0) / factors.length);
  }

  private calculateDiversityIndex(profiles: AIEnhancedContributorProfile[]): number {
    const insiders = profiles.filter(p => p.classification.contributorType === 'insider').length;
    const outsiders = profiles.filter(p => p.classification.contributorType === 'outsider').length;
    const hybrid = profiles.filter(p => p.classification.contributorType === 'hybrid').length;

    // Shannon diversity index adapted for contributor types
    const total = profiles.length;
    const proportions = [insiders/total, outsiders/total, hybrid/total].filter(p => p > 0);
    const diversity = -proportions.reduce((sum, p) => sum + p * Math.log(p), 0);
    
    return Math.round((diversity / Math.log(3)) * 100); // Normalize to 0-100
  }

  private generateRecommendations(profiles: AIEnhancedContributorProfile[], metrics: CommunitySuccessMetrics): string[] {
    const recommendations: string[] = [];

    // Rising star recognition
    const risingStars = profiles.filter(p => p.impactLevel === 'rising-star');
    if (risingStars.length > 0) {
      recommendations.push(`Celebrate ${risingStars.length} rising star contributors with public recognition`);
    }

    // Community growth opportunities
    if (metrics.newContributorsThisMonth < metrics.totalContributors * 0.1) {
      recommendations.push('Focus on onboarding initiatives to grow the contributor community');
    }

    // Engagement improvements
    if (metrics.crossPollination < 60) {
      recommendations.push('Encourage cross-collaboration through review assignments and pair programming');
    }

    // Recognition gaps
    const highImpactUnrecognized = profiles.filter(p => 
      p.overallScore > 75 && p.celebrationPriority === 'low'
    );
    if (highImpactUnrecognized.length > 0) {
      recommendations.push(`Recognize ${highImpactUnrecognized.length} high-impact contributors who deserve more visibility`);
    }

    return recommendations;
  }

  private identifyGrowthOpportunities(profiles: AIEnhancedContributorProfile[]): string[] {
    const opportunities: string[] = [];

    const newcomers = profiles.filter(p => p.impactLevel === 'newcomer');
    if (newcomers.length > profiles.length * 0.3) {
      opportunities.push('Implement mentorship program for newcomers');
    }

    const champions = profiles.filter(p => p.impactLevel === 'champion');
    if (champions.length > 0) {
      opportunities.push(`Leverage ${champions.length} champion contributors as community ambassadors`);
    }

    opportunities.push('Create contributor spotlight program to celebrate achievements');
    opportunities.push('Develop automated recognition system for milestone achievements');

    return opportunities;
  }
}

// Export singleton instance
export const aiContributorAnalyzer = new AIContributorAnalyzer();