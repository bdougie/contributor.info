/**
 * Type definitions for AI-powered contributor enrichment
 * Supports topic clustering, persona detection, and quality scoring
 */

/**
 * Persona types for contributor classification
 */
export type PersonaType =
  | 'enterprise' // SSO, corporate proxies, compliance discussions
  | 'security' // Vulnerability reports, authentication, security reviews
  | 'performance' // Optimization PRs, benchmarks, performance discussions
  | 'documentation' // README updates, doc improvements, guides
  | 'bug_hunter' // Primarily reports bugs, finds edge cases
  | 'feature_requester' // Requests new features, proposes enhancements
  | 'community_helper'; // Answers questions, mentors, helps others

/**
 * Contribution style classification
 */
export type ContributionStyle = 'code' | 'discussion' | 'mixed';

/**
 * Engagement pattern classification
 */
export type EngagementPattern = 'mentor' | 'learner' | 'reporter' | 'builder';

/**
 * Detected contributor persona with confidence scoring
 */
export interface ContributorPersona {
  /** Primary persona type(s) */
  type: PersonaType[];

  /** Confidence in persona detection (0-1) */
  confidence: number;

  /** Specific expertise areas derived from activity */
  expertise: string[];

  /** How they contribute (code, discussion, or both) */
  contributionStyle: ContributionStyle;

  /** Their engagement pattern with the community */
  engagementPattern: EngagementPattern;

  /** Reasoning for persona classification (for transparency) */
  reasoning?: string;
}

/**
 * Topic cluster representing a technical domain or theme
 */
export interface TopicCluster {
  /** Unique cluster identifier */
  id: string;

  /** Human-readable cluster label */
  label: string;

  /** Keywords representing the topic */
  keywords: string[];

  /** Number of contributors active in this topic */
  contributorCount: number;

  /** Top contributors in this topic area */
  topContributors: string[];

  /** Cluster centroid (384-dim embedding vector) */
  centroid: number[];

  /** Cluster cohesion/quality (0-1) */
  confidence: number;

  /** Sample titles from this cluster */
  sampleTitles?: string[];
}

/**
 * Contributor cluster grouping people by similar expertise
 */
export interface ContributorCluster {
  /** Unique cluster identifier */
  id: string;

  /** Primary expertise/focus of this cluster */
  expertise: string[];

  /** Contributors in this cluster */
  contributors: string[];

  /** Cluster centroid (aggregated contributor embeddings) */
  centroid: number[];

  /** Cluster quality score (0-1) */
  cohesion: number;

  /** Common topics across contributors */
  commonTopics: string[];
}

/**
 * Raw embedding cluster (before labeling)
 */
export interface EmbeddingCluster {
  /** Cluster ID */
  id: number;

  /** Cluster centroid vector */
  centroid: number[];

  /** Item IDs in this cluster */
  itemIds: string[];

  /** Cluster variance/spread */
  variance: number;
}

/**
 * Topic shift detection
 */
export interface TopicShift {
  /** Topics contributor moved away from */
  from: string[];

  /** Topics contributor moved toward */
  to: string[];

  /** Time window for this shift */
  timeframe: '7d' | '30d';

  /** Significance of the shift */
  significance: 'major' | 'minor';

  /** Confidence in shift detection (0-1) */
  confidence: number;
}

/**
 * Contribution velocity metrics
 */
export interface VelocityMetrics {
  /** Contributions in last 7 days */
  current7d: number;

  /** Contributions in previous 7 days */
  previous7d: number;

  /** Contributions in last 30 days */
  current30d: number;

  /** Contributions in previous 30 days */
  previous30d: number;

  /** Velocity trend */
  trend: 'accelerating' | 'steady' | 'declining';

  /** Percentage change */
  changePercent: number;
}

/**
 * Engagement quality breakdown
 */
export interface QualityScoreBreakdown {
  /** Overall composite score (0-100) */
  overall: number;

  /** Discussion impact score (0-100) */
  discussionImpact: number;

  /** Code review depth score (0-100) */
  codeReviewDepth: number;

  /** Issue quality score (0-100) */
  issueQuality: number;

  /** Mentor/helper score (0-100) */
  mentorScore: number;

  /** Weighting used for composite score */
  weights: {
    discussionImpact: number;
    codeReviewDepth: number;
    issueQuality: number;
    mentorScore: number;
  };
}

/**
 * Comprehensive trend analysis for a contributor
 */
export interface TrendAnalysis {
  /** Velocity trend classification */
  velocityTrend: 'accelerating' | 'steady' | 'declining';

  /** Detailed velocity data */
  velocityData: VelocityMetrics;

  /** Detected topic shifts */
  topicShifts: TopicShift[];

  /** Overall engagement pattern */
  engagementPattern: 'increasing' | 'stable' | 'decreasing';

  /** Predicted future focus areas (ML-based) */
  predictedFocus: string[];

  /** Confidence in predictions (0-1) */
  confidenceScore: number;
}

/**
 * Complete contributor enrichment data
 */
export interface ContributorEnrichment {
  /** Contributor ID */
  contributorId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Detected persona */
  persona: ContributorPersona;

  /** Primary topics (top 3-5) */
  topics: string[];

  /** Topic confidence (0-1) */
  topicConfidence: number;

  /** Quality score breakdown */
  qualityScore: QualityScoreBreakdown;

  /** Trend analysis */
  trends: TrendAnalysis;

  /** When this enrichment was generated */
  generatedAt: Date;
}

/**
 * Parameters for topic clustering
 */
export interface ClusteringOptions {
  /** Workspace to cluster */
  workspaceId: string;

  /** Number of clusters (k) */
  k?: number;

  /** Minimum cluster size */
  minClusterSize?: number;

  /** Maximum iterations for k-means */
  maxIterations?: number;

  /** Convergence threshold */
  convergenceThreshold?: number;
}

/**
 * K-means clustering result
 */
export interface ClusteringResult {
  /** Generated clusters */
  clusters: EmbeddingCluster[];

  /** Number of iterations to converge */
  iterations: number;

  /** Final variance (lower is better) */
  finalVariance: number;

  /** Whether clustering converged */
  converged: boolean;
}
