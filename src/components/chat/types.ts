export interface RepoSummaryData {
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  openIssues: number;
  recentPRs: number;
  timeRangeDays: string;
}

export interface PrAlertData {
  number: number;
  title: string;
  author: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgencyScore: number;
  reasons: string[];
  daysSinceCreated: number;
  linesChanged: number;
  url: string;
}

export interface PrAttentionData {
  alerts: PrAlertData[];
  metrics: {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface HealthFactorData {
  name: string;
  score: number;
  status: string;
  description: string;
}

export interface HealthAssessmentData {
  score: number;
  factors: HealthFactorData[];
  recommendations: string[];
  assessedAt: string;
}

export interface RecommendationData {
  title: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  type: string;
}

export interface RecommendationsData {
  recommendations: RecommendationData[];
}
