// Local types matching the Supabase function types
export interface ConfidenceFactors {
  privilegedEventsWeight: number
  activityPatternsWeight: number
  temporalConsistencyWeight: number
}

export interface ContributorMetrics {
  userId: string
  repositoryOwner: string
  repositoryName: string
  privilegedEventCount: number
  totalEventCount: number
  uniqueEventTypes: string[]
  detectionMethods: string[]
  firstSeenAt: Date
  lastSeenAt: Date
  daysSinceFirstSeen: number
  daysSinceLastSeen: number
  activitySpreadDays: number
}

export interface ConfidenceScore {
  overall: number
  components: {
    privilegedEvents: number
    activityPatterns: number
    temporalConsistency: number
  }
  factors: {
    eventDiversity: number
    activityRecency: number
    consistencyScore: number
  }
}

// Default weights for confidence calculation
export const DEFAULT_WEIGHTS: ConfidenceFactors = {
  privilegedEventsWeight: 0.4,
  activityPatternsWeight: 0.35,
  temporalConsistencyWeight: 0.25
}

// Calculate confidence score based on metrics
export function calculateConfidenceScore(
  metrics: ContributorMetrics,
  weights: ConfidenceFactors = DEFAULT_WEIGHTS
): ConfidenceScore {
  // 1. Privileged Events Component
  const privilegedRatio = metrics.totalEventCount > 0 
    ? metrics.privilegedEventCount / metrics.totalEventCount 
    : 0
  
  // Boost for absolute count of privileged events
  const privilegedBoost = Math.min(1, metrics.privilegedEventCount / 10)
  
  const privilegedEventsScore = (privilegedRatio * 0.7 + privilegedBoost * 0.3)

  // 2. Activity Patterns Component
  // Event diversity (more event types = higher score)
  const eventDiversity = Math.min(1, metrics.uniqueEventTypes.length / 8)
  
  // Detection method diversity
  const methodDiversity = Math.min(1, metrics.detectionMethods.length / 5)
  
  // Activity volume (with diminishing returns)
  const activityVolume = Math.min(1, Math.log10(metrics.totalEventCount + 1) / 2)
  
  const activityPatternsScore = (
    eventDiversity * 0.4 +
    methodDiversity * 0.4 +
    activityVolume * 0.2
  )

  // 3. Temporal Consistency Component
  // Recency factor (recent activity is weighted higher)
  const recencyScore = metrics.daysSinceLastSeen <= 7 ? 1 :
                      metrics.daysSinceLastSeen <= 30 ? 0.8 :
                      metrics.daysSinceLastSeen <= 90 ? 0.6 :
                      0.4
  
  // Consistency factor (regular activity over time)
  const expectedDays = Math.min(metrics.daysSinceFirstSeen, 90)
  const consistencyRatio = expectedDays > 0 
    ? metrics.activitySpreadDays / expectedDays 
    : 0
  const consistencyScore = Math.min(1, consistencyRatio * 2) // Boost for consistency
  
  // Longevity factor (how long they've been contributing)
  const longevityScore = Math.min(1, metrics.daysSinceFirstSeen / 180) // 6 months = full score
  
  const temporalConsistencyScore = (
    recencyScore * 0.4 +
    consistencyScore * 0.4 +
    longevityScore * 0.2
  )

  // Calculate overall score
  const overall = (
    privilegedEventsScore * weights.privilegedEventsWeight +
    activityPatternsScore * weights.activityPatternsWeight +
    temporalConsistencyScore * weights.temporalConsistencyWeight
  )

  return {
    overall: Math.min(0.5, overall), // Capped at 50% as per existing algorithm
    components: {
      privilegedEvents: privilegedEventsScore,
      activityPatterns: activityPatternsScore,
      temporalConsistency: temporalConsistencyScore
    },
    factors: {
      eventDiversity,
      activityRecency: recencyScore,
      consistencyScore
    }
  }
}