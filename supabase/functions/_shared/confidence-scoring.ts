import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isBotAccount } from './event-detection.ts';

export interface ConfidenceFactors {
  privilegedEventsWeight: number;
  activityPatternsWeight: number;
  temporalConsistencyWeight: number;
}

export interface ContributorMetrics {
  userId: string;
  repositoryOwner: string;
  repositoryName: string;
  privilegedEventCount: number;
  totalEventCount: number;
  uniqueEventTypes: string[];
  detectionMethods: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  daysSinceFirstSeen: number;
  daysSinceLastSeen: number;
  activitySpreadDays: number;
}

export interface ConfidenceScore {
  overall: number;
  components: {
    privilegedEvents: number;
    activityPatterns: number;
    temporalConsistency: number;
  };
  factors: {
    eventDiversity: number;
    activityRecency: number;
    consistencyScore: number;
  };
}

// Default weights for confidence calculation
export const DEFAULT_WEIGHTS: ConfidenceFactors = {
  privilegedEventsWeight: 0.4,
  activityPatternsWeight: 0.35,
  temporalConsistencyWeight: 0.25,
};

// Calculate contributor metrics from database
export async function getContributorMetrics(
  supabase: SupabaseClient,
  userId: string,
  repositoryOwner: string,
  repositoryName: string
): Promise<ContributorMetrics | null> {
  // Get all events for the contributor
  const { data: events, error } = await supabase
    .from('github_events_cache')
    .select('*')
    .eq('actor_login', userId)
    .eq('repository_owner', repositoryOwner)
    .eq('repository_name', repositoryName)
    .order('created_at', { ascending: true });

  if (error || !events || events.length === 0) {
    return null;
  }

  // Calculate metrics
  const privilegedEvents = events.filter((e) => e.is_privileged);
  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const detectionMethods = [
    ...new Set(privilegedEvents.map((e) => e.processing_notes).filter(Boolean)),
  ];

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const firstSeenAt = new Date(firstEvent.created_at);
  const lastSeenAt = new Date(lastEvent.created_at);

  const now = new Date();
  const daysSinceFirstSeen = Math.floor(
    (now.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysSinceLastSeen = Math.floor(
    (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate activity spread (how many unique days they were active)
  const uniqueDays = new Set(events.map((e) => new Date(e.created_at).toDateString())).size;

  return {
    userId,
    repositoryOwner,
    repositoryName,
    privilegedEventCount: privilegedEvents.length,
    totalEventCount: events.length,
    uniqueEventTypes: eventTypes,
    detectionMethods,
    firstSeenAt,
    lastSeenAt,
    daysSinceFirstSeen,
    daysSinceLastSeen,
    activitySpreadDays: uniqueDays,
  };
}

// Calculate confidence score based on metrics
export function calculateConfidenceScore(
  metrics: ContributorMetrics,
  weights: ConfidenceFactors = DEFAULT_WEIGHTS
): ConfidenceScore {
  // 1. Privileged Events Component
  const privilegedRatio =
    metrics.totalEventCount > 0 ? metrics.privilegedEventCount / metrics.totalEventCount : 0;

  // Boost for absolute count of privileged events
  const privilegedBoost = Math.min(1, metrics.privilegedEventCount / 10);

  const privilegedEventsScore = privilegedRatio * 0.7 + privilegedBoost * 0.3;

  // 2. Activity Patterns Component
  // Event diversity (more event types = higher score)
  const eventDiversity = Math.min(1, metrics.uniqueEventTypes.length / 8);

  // Detection method diversity
  const methodDiversity = Math.min(1, metrics.detectionMethods.length / 5);

  // Activity volume (with diminishing returns)
  const activityVolume = Math.min(1, Math.log10(metrics.totalEventCount + 1) / 2);

  const activityPatternsScore = eventDiversity * 0.4 + methodDiversity * 0.4 + activityVolume * 0.2;

  // 3. Temporal Consistency Component
  // Recency factor (recent activity is weighted higher)
  const recencyScore =
    metrics.daysSinceLastSeen <= 7
      ? 1
      : metrics.daysSinceLastSeen <= 30
        ? 0.8
        : metrics.daysSinceLastSeen <= 90
          ? 0.6
          : 0.4;

  // Consistency factor (regular activity over time)
  const expectedDays = Math.min(metrics.daysSinceFirstSeen, 90);
  const consistencyRatio = expectedDays > 0 ? metrics.activitySpreadDays / expectedDays : 0;
  const consistencyScore = Math.min(1, consistencyRatio * 2); // Boost for consistency

  // Longevity factor (how long they've been contributing)
  const longevityScore = Math.min(1, metrics.daysSinceFirstSeen / 180); // 6 months = full score

  const temporalConsistencyScore =
    recencyScore * 0.4 + consistencyScore * 0.4 + longevityScore * 0.2;

  // Calculate overall score
  const overall =
    privilegedEventsScore * weights.privilegedEventsWeight +
    activityPatternsScore * weights.activityPatternsWeight +
    temporalConsistencyScore * weights.temporalConsistencyWeight;

  return {
    overall: Math.min(0.5, overall),
    components: {
      privilegedEvents: privilegedEventsScore,
      activityPatterns: activityPatternsScore,
      temporalConsistency: temporalConsistencyScore,
    },
    factors: {
      eventDiversity,
      activityRecency: recencyScore,
      consistencyScore,
    },
  };
}

// Determine role based on confidence score and patterns
export function determineRole(
  confidenceScore: number,
  metrics: ContributorMetrics
): 'owner' | 'maintainer' | 'contributor' | 'bot' {
  // Bot accounts get dedicated bot role, regardless of confidence
  if (isBotAccount(metrics.userId)) {
    return 'bot';
  }

  // Owner detection (very high confidence + specific patterns)
  if (confidenceScore >= 0.95 && metrics.detectionMethods.includes('admin_action')) {
    return 'owner';
  }

  // Maintainer detection
  if (confidenceScore >= 0.8 || (confidenceScore >= 0.7 && metrics.privilegedEventCount >= 5)) {
    return 'maintainer';
  }

  // Default to contributor
  return 'contributor';
}

// Update contributor role with confidence tracking
export async function updateContributorRole(
  supabase: SupabaseClient,
  metrics: ContributorMetrics,
  confidenceScore: ConfidenceScore
) {
  const role = determineRole(confidenceScore.overall, metrics);

  // Get current role for comparison
  const { data: currentRole } = await supabase
    .from('contributor_roles')
    .select('*')
    .eq('user_id', metrics.userId)
    .eq('repository_owner', metrics.repositoryOwner)
    .eq('repository_name', metrics.repositoryName)
    .maybeSingle();

  const roleData = {
    user_id: metrics.userId,
    repository_owner: metrics.repositoryOwner,
    repository_name: metrics.repositoryName,
    role,
    confidence_score: confidenceScore.overall,
    detection_methods: metrics.detectionMethods,
    permission_events_count: metrics.privilegedEventCount,
    last_verified: new Date().toISOString(),
  };

  // Upsert role
  const { data: newRole, error } = await supabase
    .from('contributor_roles')
    .upsert(roleData, {
      onConflict: 'user_id,repository_owner,repository_name',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating role:', error);
    return;
  }

  // Log significant changes
  const significantChange =
    !currentRole ||
    currentRole.role !== role ||
    Math.abs(currentRole.confidence_score - confidenceScore.overall) > 0.1;

  if (significantChange && newRole) {
    await supabase.from('contributor_role_history').insert({
      contributor_role_id: newRole.id,
      user_id: metrics.userId,
      repository_owner: metrics.repositoryOwner,
      repository_name: metrics.repositoryName,
      previous_role: currentRole?.role || null,
      new_role: role,
      previous_confidence: currentRole?.confidence_score || null,
      new_confidence: confidenceScore.overall,
      change_reason: `Confidence update: ${JSON.stringify(confidenceScore.factors)}`,
      detection_methods: metrics.detectionMethods,
    });
  }
}

// Batch update confidence scores for a repository
export async function batchUpdateConfidenceScores(
  supabase: SupabaseClient,
  repositoryOwner: string,
  repositoryName: string
) {
  // Get all contributors with events
  const { data: contributors } = await supabase
    .from('github_events_cache')
    .select('actor_login')
    .eq('repository_owner', repositoryOwner)
    .eq('repository_name', repositoryName)
    .not('actor_login', 'is', null);

  if (!contributors) return;

  const uniqueContributors = [...new Set(contributors.map((c) => c.actor_login))];

  for (const userId of uniqueContributors) {
    const metrics = await getContributorMetrics(supabase, userId, repositoryOwner, repositoryName);

    if (metrics) {
      const confidenceScore = calculateConfidenceScore(metrics);
      await updateContributorRole(supabase, metrics, confidenceScore);
    }
  }
}
