/**
 * Rising Stars Data Generator
 * Extracted functions for generating demo rising stars data
 */

import type { RisingStarContributor, RisingStarsData } from '@/lib/analytics/rising-stars-data';
import {
  CONTRIBUTION_DATE_RANGES,
  SIZE_SCALING,
  getProfileByIndex,
  getRandomInRange,
  getRandomFloatInRange,
} from './activity-profiles';

export interface ContributorInput {
  username: string;
  avatar_url?: string;
}

/**
 * Generate activity metrics for a contributor based on their profile
 */
export function generateActivityMetrics(profileIndex: number) {
  const profile = getProfileByIndex(profileIndex);

  return {
    commits: getRandomInRange(profile.commits),
    pullRequests: getRandomInRange(profile.pullRequests),
    issues: getRandomInRange(profile.issues),
    comments: getRandomInRange(profile.comments),
    reviews: getRandomInRange(profile.reviews),
    discussions: getRandomInRange(profile.discussions),
    velocityScore: getRandomFloatInRange(profile.velocityScore),
    growthRate: getRandomFloatInRange(profile.growthRate),
  };
}

/**
 * Calculate contribution dates for a contributor
 */
export function calculateContributionDates(index: number) {
  const isNewContributor = index < 5;
  const maxDays = isNewContributor
    ? CONTRIBUTION_DATE_RANGES.NEW_CONTRIBUTORS_MAX_DAYS
    : CONTRIBUTION_DATE_RANGES.REGULAR_CONTRIBUTORS_MAX_DAYS;

  const daysAgo = Math.random() * maxDays;
  const firstContributionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const lastContributionDaysAgo =
    Math.random() * CONTRIBUTION_DATE_RANGES.LAST_CONTRIBUTION_MAX_DAYS_AGO;
  const lastContributionDate = new Date(Date.now() - lastContributionDaysAgo * 24 * 60 * 60 * 1000);

  const contributionSpan = Math.ceil(daysAgo - lastContributionDaysAgo);

  return {
    firstContributionDate,
    lastContributionDate,
    contributionSpan,
    daysAgo,
  };
}

/**
 * Determine contributor status (new/rising star)
 */
export function determineContributorStatus(daysAgo: number, velocityScore: number) {
  const isNewContributor = daysAgo < CONTRIBUTION_DATE_RANGES.NEW_CONTRIBUTOR_THRESHOLD_DAYS;
  const isRisingStar =
    velocityScore > CONTRIBUTION_DATE_RANGES.RISING_STAR_MIN_VELOCITY &&
    daysAgo < CONTRIBUTION_DATE_RANGES.RISING_STAR_MAX_AGE_DAYS &&
    Math.random() > 0.5;

  return { isNewContributor, isRisingStar };
}

/**
 * Transform contributor to rising star data point
 */
export function transformToRisingStarDataPoint(
  contributor: ContributorInput,
  index: number
): RisingStarsData['data'][0] {
  const metrics = generateActivityMetrics(index % 6);
  const dates = calculateContributionDates(index);
  const status = determineContributorStatus(dates.daysAgo, metrics.velocityScore);

  const totalActivity =
    metrics.commits +
    metrics.pullRequests +
    metrics.issues +
    metrics.comments +
    metrics.reviews +
    metrics.discussions;

  const risingStarContributor: RisingStarContributor = {
    login: contributor.username,
    avatar_url: contributor.avatar_url || '',
    github_id: Math.floor(Math.random() * 100000),
    ...metrics,
    totalActivity,
    firstContributionDate: dates.firstContributionDate.toISOString(),
    lastContributionDate: dates.lastContributionDate.toISOString(),
    contributionSpan: dates.contributionSpan,
    ...status,
  };

  return {
    x: metrics.commits + metrics.pullRequests, // Code contributions
    y: metrics.issues + metrics.comments + metrics.reviews + metrics.discussions, // Non-code
    size: Math.min(
      Math.max(metrics.velocityScore * SIZE_SCALING.MULTIPLIER, SIZE_SCALING.MIN_SIZE),
      SIZE_SCALING.MAX_SIZE
    ),
    contributor: risingStarContributor,
  };
}

/**
 * Generate complete rising stars data from contributors
 */
export function generateRisingStarsData(contributors: ContributorInput[]): RisingStarsData[] {
  const data = contributors.map((contributor, idx) =>
    transformToRisingStarDataPoint(contributor, idx)
  );

  return [
    {
      id: 'demo-rising-stars',
      data,
    },
  ];
}
