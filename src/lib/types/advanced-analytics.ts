// Advanced Analytics - High-Impact Contributor Recognition Types
// Focus: Celebrating community success and recognizing valuable contributors

export type ContributorTrustLevel = 'core' | 'trusted' | 'active' | 'occasional' | 'new';
export type ContributorType = 'insider' | 'outsider' | 'hybrid';
export type BurnoutRisk = 'low' | 'medium' | 'high' | 'critical';
export type DependencyLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

// High-Stakes Contributor Identification
export interface ContributorDependencyAnalysis {
  login: string;
  avatar_url: string;
  github_id: number;
  
  // Business dependency tracking
  dependencyLevel: DependencyLevel;
  businessImpactScore: number; // 0-100 scale
  keySystemsOwnership: string[]; // Critical systems this contributor maintains
  busFactor: number; // How much knowledge is concentrated in this person
  replacementDifficulty: number; // 1-10 scale of how hard to replace
  
  // External signals of business dependency
  linkedCompanyRepos?: string[]; // Repos from their company depending on this project
  corporateEmail?: string; // Corporate email if identified
  employerDependency?: {
    company: string;
    confidence: number; // 0-1 confidence in employer identification
    businessRelationship: 'vendor' | 'customer' | 'partner' | 'competitor' | 'unknown';
  };
}

// Contribution Consistency Scoring
export interface ContributionConsistencyMetrics {
  login: string;
  consistencyScore: number; // 0-100, higher = more consistent
  activityPattern: {
    weeklyCommits: number[];
    monthlyTrend: 'increasing' | 'stable' | 'decreasing' | 'volatile';
    longestActiveStreak: number; // days
    longestInactiveStreak: number; // days
    averageCommitsPerWeek: number;
    standardDeviation: number; // consistency indicator
  };
  reliabilityMetrics: {
    averageResponseTime: number; // hours to respond to reviews/comments
    commitmentKeepingRate: number; // % of promised deliverables completed
    codeQualityConsistency: number; // variance in review feedback scores
  };
}

// External vs Internal Contributor Breakdown
export interface ContributorClassification {
  login: string;
  contributorType: ContributorType;
  trustLevel: ContributorTrustLevel;
  
  // Classification signals
  classificationConfidence: number; // 0-1 confidence in classification
  insiderSignals: {
    hasCompanyEmail: boolean;
    commitsDuringBusinessHours: number; // % of commits during 9-5
    accessToPrivateRepos: boolean;
    organizationMember: boolean;
    employeeGitConfig: boolean; // Git config suggests company email
  };
  
  // Trust level indicators
  trustIndicators: {
    monthsActive: number;
    codeReviewParticipation: number; // % of PRs where they participated in reviews
    maintainerNominations: number; // times nominated for maintainer role
    securitySensitiveCommits: number; // commits to security-critical areas
    communityReputation: number; // based on external references/mentions
  };
}

// Top Contributor Risk Assessment
export interface ContributorRiskAssessment {
  login: string;
  riskLevel: BurnoutRisk;
  riskFactors: {
    workloadIncreasing: boolean;
    responseTimeIncreasing: boolean;
    reviewQualityDecreasing: boolean;
    communityInteractionDecreasing: boolean;
    codeOwnershipConcentration: number; // 0-1, higher = more concentrated
  };
  
  // Succession planning
  succession: {
    hasBackup: boolean;
    backupContributors: string[]; // usernames of potential successors
    knowledgeTransferScore: number; // 0-100, how well documented their work is
    criticalSkillsAtRisk: string[]; // specific skills/knowledge that could be lost
  };
  
  // Early warning indicators
  warningSignals: {
    decreasedActivity: boolean;
    increasedNegativeInteractions: boolean;
    mentionedLeaving: boolean;
    jobChangeIndicators: boolean; // LinkedIn updates, etc.
    projectFocusShifting: boolean; // contributing to competing projects
  };
}

// Community ROI Metrics
export interface CommunityROIMetrics {
  timeRange: {
    start: string;
    end: string;
  };
  
  // Community contribution multiplier
  contributionMultiplier: {
    communityContributions: number;
    coreTeamContributions: number;
    multiplierRatio: number; // community/core ratio
    communityVelocityImpact: number; // how much community accelerates development
  };
  
  // Feature adoption by contributor type
  featureAdoption: {
    communityDrivenFeatures: number;
    coreTeamFeatures: number;
    adoptionRateByType: {
      [key in ContributorType]: number;
    };
  };
  
  // Time-to-merge analysis
  timeToMerge: {
    averageByTrustLevel: {
      [key in ContributorTrustLevel]: number; // hours
    };
    communityPRsMedianTime: number;
    corePRsMedianTime: number;
    reviewBottlenecks: string[]; // contributor logins who are bottlenecks
  };
  
  // Development ratio
  developmentRatio: {
    communityDrivenPRs: number;
    teamDrivenPRs: number;
    ratioTrend: 'community-increasing' | 'team-increasing' | 'balanced';
  };
}

// Contributor Health & Retention
export interface ContributorHealthMetrics {
  login: string;
  healthScore: number; // 0-100 composite score
  
  // Activity pattern analysis
  activityHealth: {
    currentVelocity: number; // PRs per month
    velocityTrend: 'increasing' | 'stable' | 'decreasing';
    workloadBalance: number; // 0-100, sustainable workload indicator
    collaborationScore: number; // how well they work with others
  };
  
  // Rising star indicators
  risingStarMetrics?: {
    growthRate: number; // month-over-month improvement
    learningVelocity: number; // how quickly they adopt new practices
    communityEngagement: number; // mentoring, helping others
    technicalSkillProgression: number; // complexity of contributions over time
    leadershipPotential: number; // 0-100 based on community interactions
  };
  
  // Lifecycle stage
  lifecycleStage: {
    stage: 'newcomer' | 'growing' | 'established' | 'veteran' | 'declining';
    monthsInStage: number;
    expectedProgression: string; // what's the likely next stage
    interventionNeeded: boolean; // whether proactive support is needed
  };
}

// Executive Summary Dashboard Data
export interface ExecutiveSummaryMetrics {
  timestamp: string;
  repository: {
    full_name: string;
    owner: string;
    name: string;
  };
  
  // High-level KPIs
  totalContributors: {
    total: number;
    byTrustLevel: {
      [key in ContributorTrustLevel]: number;
    };
    byType: {
      [key in ContributorType]: number;
    };
  };
  
  // PR Velocity segmented by contributor type
  prVelocity: {
    totalPRsThisMonth: number;
    averageTimeToMerge: number; // hours
    byContributorType: {
      [key in ContributorType]: {
        count: number;
        avgTimeToMerge: number;
        mergeRate: number; // % of PRs that get merged
      };
    };
  };
  
  // Community health score (0-100)
  communityHealthScore: number;
  healthFactors: {
    contributorDiversity: number; // 0-100
    knowledgeDistribution: number; // 0-100, inverse of bus factor
    responseiveness: number; // 0-100
    growthTrend: number; // 0-100
    retentionRate: number; // 0-100
  };
  
  // Critical alerts
  criticalAlerts: Array<{
    type: 'bus_factor' | 'burnout_risk' | 'declining_health' | 'knowledge_loss';
    severity: 'low' | 'medium' | 'high' | 'critical';
    contributor?: string;
    message: string;
    actionRequired: string;
    estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
  }>;
  
  // Trend indicators
  trends: {
    contributorGrowth: number; // month-over-month % change
    communityEngagement: number; // % change in community participation
    codeQualityTrend: 'improving' | 'stable' | 'declining';
    diversityTrend: 'improving' | 'stable' | 'declining';
  };
}

// Bus Factor Analysis with Succession Planning
export interface BusFactorAnalysis {
  repository: string;
  overallBusFactor: number; // number of people who could leave before major impact
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Critical knowledge areas
  knowledgeAreas: Array<{
    area: string; // e.g., "authentication system", "CI/CD pipeline"
    expertsCount: number;
    experts: string[]; // contributor logins
    documentationScore: number; // 0-100, how well documented
    complexityScore: number; // 0-100, how complex to learn
    criticalityScore: number; // 0-100, how critical to the project
  }>;
  
  // Succession planning recommendations
  successionPlan: Array<{
    criticalContributor: string;
    riskIfLost: 'low' | 'medium' | 'high' | 'critical';
    potentialSuccessors: Array<{
      login: string;
      readinessScore: number; // 0-100, how ready they are to take over
      skillGaps: string[]; // what they'd need to learn
      estimatedRampTime: number; // weeks to full productivity
    }>;
    mitigationActions: string[];
  }>;
}