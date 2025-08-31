import React from 'react';
import { z } from 'zod';
import {
  validateChartData,
  safeParseChartData,
  ContributionStatsSchema,
  LanguageStatsSchema,
  ActivityDataSchema,
  RisingStarsDataSchema,
  transformContributionStats,
  transformLanguageStats,
  type LineChartData,
  type BarChartData,
  type ActivityData,
  type RisingStarsData,
} from '../validation/chart-data-schemas';

/**
 * Example fetcher for GitHub contribution stats with Zod validation
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Validated and transformed chart data
 */
export async function fetchContributionStats(owner: string, repo: string): Promise<LineChartData> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/stats/contributors`);

  if (!response.ok) {
    throw new Error(`Failed to fetch contribution stats: ${response.statusText}`);
  }

  const rawData = await response.json();

  // Validate the API response with Zod
  const validatedStats = rawData.map((contributor: unknown) =>
    validateChartData(contributor, ContributionStatsSchema)
  );

  // Transform to chart format
  // For simplicity, we'll aggregate all contributors
  const aggregated = validatedStats[0]; // Use first contributor as example
  return transformContributionStats(aggregated);
}

/**
 * Example fetcher for repository languages with Zod validation
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Validated and transformed chart data
 */
export async function fetchLanguageStats(owner: string, repo: string): Promise<BarChartData> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);

  if (!response.ok) {
    throw new Error(`Failed to fetch language stats: ${response.statusText}`);
  }

  const rawData = await response.json();

  // Validate the API response with Zod
  const validatedLanguages = validateChartData(rawData, LanguageStatsSchema);

  // Transform to chart format
  return transformLanguageStats(validatedLanguages);
}

/**
 * Example fetcher for activity data with safe parsing and fallback
 * @param projectId - Project identifier
 * @returns Validated activity data or fallback
 */
export async function fetchActivityData(projectId: string): Promise<ActivityData> {
  const fallbackData: ActivityData = {
    dates: [],
    commits: [],
    pullRequests: [],
    issues: [],
  };

  try {
    const response = await fetch(`/api/projects/${projectId}/activity`);

    if (!response.ok) {
      console.warn('Failed to fetch activity data, using fallback');
      return fallbackData;
    }

    const rawData = await response.json();

    // Use safe parsing with fallback
    return safeParseChartData(rawData, ActivityDataSchema, fallbackData);
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return fallbackData;
  }
}

/**
 * Example fetcher for rising stars data with validation
 * @param period - Time period for rising stars
 * @returns Validated rising stars data
 */
export async function fetchRisingStarsData(
  period: 'week' | 'month' | 'year'
): Promise<RisingStarsData> {
  const response = await fetch(`/api/analytics/rising-stars?period=${period}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch rising stars: ${response.statusText}`);
  }

  const rawData = await response.json();

  // Validate the API response with Zod
  return validateChartData(rawData, RisingStarsDataSchema);
}

/**
 * Example of using Zod validation in a React hook
 */
export function useValidatedChartData<T>(
  fetcher: () => Promise<unknown>,
  schema: z.ZodSchema<T>,
  fallback: T
): { data: T; loading: boolean; error: Error | null } {
  const [data, setData] = React.useState<T>(fallback);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const rawData = await fetcher();

        if (!cancelled) {
          const validated = validateChartData(rawData, schema);
          setData(validated);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setData(fallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [fetcher, schema, fallback]);

  return { data, loading, error };
}

// Re-export for convenience
export { validateChartData, safeParseChartData } from '../validation/chart-data-schemas';
export type {
  LineChartData,
  BarChartData,
  AreaChartData,
  RisingStarsData,
  ActivityData,
  ContributionStats,
  LanguageStats,
} from '../validation/chart-data-schemas';
