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

export interface RepoSummaryData {
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  openIssues: number;
  recentPRs: number;
  timeRangeDays: number;
}

export interface ContributorData {
  login: string;
  qualityScore: number;
  confidenceScore: number;
  prsOpened: number;
  prsMerged: number;
  reviewsGiven: number;
  issuesOpened: number;
}

export interface ContributorRankingsData {
  repository: string;
  total: number;
  contributors: ContributorData[];
}

export interface SemanticSearchItemData {
  type: string;
  number: number;
  title: string;
  url: string;
  state: string;
  author: string | null;
  age: string | null;
  similarity: number;
  bodyPreview: string | null;
}

export interface SemanticSearchData {
  items: SemanticSearchItemData[];
  elapsed_ms: number;
}

export type ToolResultData =
  | RecommendationsData
  | PrAttentionData
  | HealthAssessmentData
  | RepoSummaryData
  | ContributorRankingsData
  | SemanticSearchData;

export const EXAMPLE_QUESTIONS = [
  'Give me an overview of this repo',
  'Which PRs need attention right now?',
  'How healthy is this repository?',
  'What recommendations do you have?',
  'Who are the top contributors?',
] as const;
