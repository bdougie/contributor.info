import { z } from 'zod';

/**
 * Chart Data Validation Schemas
 *
 * These schemas validate data from 3rd party APIs before passing to chart components,
 * ensuring type safety and preventing runtime errors from malformed data.
 */

// Base dataset schema for all chart types
export const ChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.union([z.number(), z.null()])),
  color: z.string().optional(),
});

// Line chart specific dataset
export const LineChartDatasetSchema = ChartDatasetSchema.extend({
  strokeWidth: z.number().optional(),
  fill: z.boolean().optional(),
  points: z.boolean().optional(),
});

// Bar chart specific dataset
export const BarChartDatasetSchema = ChartDatasetSchema.extend({
  grouped: z.boolean().optional(),
});

// Area chart specific dataset
export const AreaChartDatasetSchema = ChartDatasetSchema.extend({
  strokeWidth: z.number().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  stacked: z.boolean().optional(),
});

// Complete chart data schemas
export const LineChartDataSchema = z.object({
  labels: z.array(z.union([z.string(), z.number()])),
  datasets: z.array(LineChartDatasetSchema),
});

export const BarChartDataSchema = z.object({
  labels: z.array(z.union([z.string(), z.number()])),
  datasets: z.array(BarChartDatasetSchema),
});

export const AreaChartDataSchema = z.object({
  labels: z.array(z.union([z.string(), z.number()])),
  datasets: z.array(AreaChartDatasetSchema),
});

// Export types inferred from schemas
export type LineChartData = z.infer<typeof LineChartDataSchema>;
export type BarChartData = z.infer<typeof BarChartDataSchema>;
export type AreaChartData = z.infer<typeof AreaChartDataSchema>;

/**
 * Validates and transforms API response data for charts
 * @param data - Raw data from API
 * @param schema - Zod schema to validate against
 * @returns Validated and typed data
 */
export function validateChartData<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Chart data validation failed:', error.errors);
      throw new Error('Invalid chart data format');
    }
    throw error;
  }
}

/**
 * Safely parses API response for chart data with fallback
 * @param data - Raw data from API
 * @param schema - Zod schema to validate against
 * @param fallback - Fallback data if validation fails
 * @returns Validated data or fallback
 */
export function safeParseChartData<T>(data: unknown, schema: z.ZodSchema<T>, fallback: T): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('Chart data validation failed, using fallback:', result.error.errors);
  return fallback;
}

// Schema for Rising Stars chart data from API
export const RisingStarsDataSchema = z.object({
  contributors: z.array(
    z.object({
      login: z.string(),
      avatar_url: z.string().url(),
      contributions: z.number(),
      velocity: z.number(),
      trend: z.enum(['rising', 'stable', 'declining']).optional(),
    })
  ),
});

export type RisingStarsData = z.infer<typeof RisingStarsDataSchema>;

// Schema for Activity chart data from API
export const ActivityDataSchema = z.object({
  dates: z.array(z.string()),
  commits: z.array(z.number()),
  pullRequests: z.array(z.number()),
  issues: z.array(z.number()),
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;

// Schema for contribution stats from GitHub API
export const ContributionStatsSchema = z.object({
  total: z.number(),
  weeks: z.array(
    z.object({
      w: z.number(), // Unix timestamp
      a: z.number(), // Additions
      d: z.number(), // Deletions
      c: z.number(), // Commits
    })
  ),
  author: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string().url(),
    })
    .optional(),
});

export type ContributionStats = z.infer<typeof ContributionStatsSchema>;

// Schema for repository languages from GitHub API
export const LanguageStatsSchema = z.record(z.string(), z.number());

export type LanguageStats = z.infer<typeof LanguageStatsSchema>;

/**
 * Transform GitHub contribution stats to chart format
 * @param stats - Raw contribution stats from GitHub API
 * @returns Chart-ready data
 */
export function transformContributionStats(stats: ContributionStats): LineChartData {
  const labels = stats.weeks.map((week) => new Date(week.w * 1000).toLocaleDateString());
  const commits = stats.weeks.map((week) => week.c);
  const additions = stats.weeks.map((week) => week.a);
  const deletions = stats.weeks.map((week) => week.d);

  return {
    labels,
    datasets: [
      {
        label: 'Commits',
        data: commits,
        color: '#3b82f6',
      },
      {
        label: 'Additions',
        data: additions,
        color: '#10b981',
      },
      {
        label: 'Deletions',
        data: deletions,
        color: '#ef4444',
      },
    ],
  };
}

/**
 * Transform language stats to chart format
 * @param languages - Raw language stats from GitHub API
 * @returns Chart-ready data
 */
export function transformLanguageStats(languages: LanguageStats): BarChartData {
  const sorted = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 languages

  return {
    labels: sorted.map(([lang]) => lang),
    datasets: [
      {
        label: 'Lines of Code',
        data: sorted.map(([, lines]) => lines),
        color: '#8b5cf6',
      },
    ],
  };
}
