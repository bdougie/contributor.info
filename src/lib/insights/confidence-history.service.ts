import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { toUTCTimestamp } from '../utils/date-formatting';

/**
 * Represents a single point in confidence history
 */
export interface ConfidenceHistoryPoint {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  confidenceScore: number;
  timeRangeDays: number;
  breakdown?: {
    starForkConfidence: number;
    engagementConfidence: number;
    retentionConfidence: number;
    qualityConfidence: number;
    totalStargazers?: number;
    totalForkers?: number;
    contributorCount?: number;
    conversionRate?: number;
  };
  calculatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  dataVersion: number;
  calculationTimeMs?: number;
}

/**
 * Trend analysis result
 */
export interface ConfidenceTrend {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  currentScore: number;
  previousScore: number;
  dataPoints: number;
}

/**
 * Period comparison result
 */
export interface ConfidenceComparison {
  period: {
    start: Date;
    end: Date;
  };
  score: number;
  breakdown?: ConfidenceHistoryPoint['breakdown'];
  calculatedAt: Date;
}

/**
 * Save a confidence score to history
 */
export async function saveConfidenceToHistory(
  client: SupabaseClient<Database>,
  owner: string,
  repo: string,
  timeRangeDays: number,
  score: number,
  breakdown?: ConfidenceHistoryPoint['breakdown'],
  calculationTimeMs?: number
): Promise<void> {
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - timeRangeDays);

  const { error } = await client.from('repository_confidence_history').insert({
    repository_owner: owner,
    repository_name: repo,
    confidence_score: score,
    time_range_days: timeRangeDays,
    breakdown: breakdown ? (breakdown as unknown as Record<string, unknown>) : null,
    calculated_at: toUTCTimestamp(now),
    period_start: toUTCTimestamp(periodStart),
    period_end: toUTCTimestamp(periodEnd),
    data_version: 1,
    calculation_time_ms: calculationTimeMs,
  });

  if (error) {
    console.error('[Confidence History] Error saving to history:', error);
    throw error;
  }

  console.log(
    '[Confidence History] Saved score for %s/%s: %s% (%s days)',
    owner,
    repo,
    score,
    timeRangeDays
  );
}

/**
 * Fetch historical confidence scores for trend analysis
 */
export async function getConfidenceHistory(
  client: SupabaseClient<Database>,
  owner: string,
  repo: string,
  timeRangeDays: number,
  lookbackPeriods: number = 4
): Promise<ConfidenceHistoryPoint[]> {
  // Calculate how far back to look (lookbackPeriods * timeRangeDays)
  const lookbackDays = lookbackPeriods * timeRangeDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const { data, error } = await client
    .from('repository_confidence_history')
    .select('*')
    .eq('repository_owner', owner)
    .eq('repository_name', repo)
    .eq('time_range_days', timeRangeDays)
    .gte('calculated_at', toUTCTimestamp(cutoffDate))
    .order('calculated_at', { ascending: true });

  if (error) {
    console.error('[Confidence History] Error fetching history:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    repositoryOwner: row.repository_owner,
    repositoryName: row.repository_name,
    confidenceScore: row.confidence_score,
    timeRangeDays: row.time_range_days,
    breakdown: row.breakdown as ConfidenceHistoryPoint['breakdown'],
    calculatedAt: new Date(row.calculated_at),
    periodStart: new Date(row.period_start),
    periodEnd: new Date(row.period_end),
    dataVersion: row.data_version || 1,
    calculationTimeMs: row.calculation_time_ms || undefined,
  }));
}

/**
 * Calculate trend direction and percentage change from history
 */
export function calculateConfidenceTrend(
  history: ConfidenceHistoryPoint[]
): ConfidenceTrend | null {
  if (history.length < 2) {
    return null;
  }

  // Sort by calculation date to ensure correct order
  const sortedHistory = [...history].sort(
    (a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime()
  );

  const currentScore = sortedHistory[sortedHistory.length - 1].confidenceScore;
  const previousScore = sortedHistory[sortedHistory.length - 2].confidenceScore;

  const changePercent =
    previousScore > 0 ? ((currentScore - previousScore) / previousScore) * 100 : 0;

  // Determine direction with 5% threshold for "stable"
  let direction: 'improving' | 'declining' | 'stable';
  if (Math.abs(changePercent) < 5) {
    direction = 'stable';
  } else if (changePercent > 0) {
    direction = 'improving';
  } else {
    direction = 'declining';
  }

  return {
    direction,
    changePercent,
    currentScore,
    previousScore,
    dataPoints: sortedHistory.length,
  };
}

/**
 * Get confidence for specific date ranges (comparison)
 */
export async function getConfidenceForPeriods(
  client: SupabaseClient<Database>,
  owner: string,
  repo: string,
  periods: Array<{ start: Date; end: Date }>
): Promise<ConfidenceComparison[]> {
  const results: ConfidenceComparison[] = [];

  for (const period of periods) {
    const { data, error } = await client
      .from('repository_confidence_history')
      .select('*')
      .eq('repository_owner', owner)
      .eq('repository_name', repo)
      .gte('period_start', toUTCTimestamp(period.start))
      .lte('period_end', toUTCTimestamp(period.end))
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Confidence History] Error fetching period comparison:', error);
      continue;
    }

    if (data) {
      results.push({
        period,
        score: data.confidence_score,
        breakdown: data.breakdown as ConfidenceHistoryPoint['breakdown'],
        calculatedAt: new Date(data.calculated_at),
      });
    }
  }

  return results;
}

/**
 * Get the most recent confidence score from history
 */
export async function getLatestConfidenceFromHistory(
  client: SupabaseClient<Database>,
  owner: string,
  repo: string,
  timeRangeDays: number
): Promise<ConfidenceHistoryPoint | null> {
  const { data, error } = await client
    .from('repository_confidence_history')
    .select('*')
    .eq('repository_owner', owner)
    .eq('repository_name', repo)
    .eq('time_range_days', timeRangeDays)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Confidence History] Error fetching latest from history:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    repositoryOwner: data.repository_owner,
    repositoryName: data.repository_name,
    confidenceScore: data.confidence_score,
    timeRangeDays: data.time_range_days,
    breakdown: data.breakdown as ConfidenceHistoryPoint['breakdown'],
    calculatedAt: new Date(data.calculated_at),
    periodStart: new Date(data.period_start),
    periodEnd: new Date(data.period_end),
    dataVersion: data.data_version || 1,
    calculationTimeMs: data.calculation_time_ms || undefined,
  };
}
