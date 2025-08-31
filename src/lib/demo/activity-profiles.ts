/**
 * Activity Profile Constants for Demo Data Generation
 * Extracted from demo-workspace-page to improve maintainability
 */

export interface ActivityRange {
  min: number;
  max: number;
}

export interface ActivityProfile {
  name: string;
  commits: ActivityRange;
  pullRequests: ActivityRange;
  issues: ActivityRange;
  comments: ActivityRange;
  reviews: ActivityRange;
  discussions: ActivityRange;
  velocityScore: ActivityRange;
  growthRate: ActivityRange;
}

// Define activity profiles for different contributor types
export const ACTIVITY_PROFILES: Record<string, ActivityProfile> = {
  VERY_HIGH: {
    name: 'Very High Activity',
    commits: { min: 120, max: 200 },
    pullRequests: { min: 60, max: 100 },
    issues: { min: 40, max: 70 },
    comments: { min: 70, max: 120 },
    reviews: { min: 40, max: 70 },
    discussions: { min: 30, max: 50 },
    velocityScore: { min: 25, max: 40 },
    growthRate: { min: 100, max: 250 },
  },
  HIGH: {
    name: 'High Activity',
    commits: { min: 60, max: 120 },
    pullRequests: { min: 30, max: 60 },
    issues: { min: 20, max: 40 },
    comments: { min: 40, max: 80 },
    reviews: { min: 20, max: 40 },
    discussions: { min: 15, max: 30 },
    velocityScore: { min: 15, max: 25 },
    growthRate: { min: 50, max: 150 },
  },
  MEDIUM_HIGH: {
    name: 'Medium-High Activity',
    commits: { min: 30, max: 70 },
    pullRequests: { min: 15, max: 35 },
    issues: { min: 10, max: 25 },
    comments: { min: 20, max: 50 },
    reviews: { min: 10, max: 25 },
    discussions: { min: 8, max: 18 },
    velocityScore: { min: 8, max: 16 },
    growthRate: { min: 20, max: 100 },
  },
  MEDIUM: {
    name: 'Medium Activity',
    commits: { min: 15, max: 40 },
    pullRequests: { min: 8, max: 23 },
    issues: { min: 5, max: 15 },
    comments: { min: 10, max: 30 },
    reviews: { min: 5, max: 15 },
    discussions: { min: 4, max: 12 },
    velocityScore: { min: 5, max: 10 },
    growthRate: { min: 10, max: 60 },
  },
  LOW_MEDIUM: {
    name: 'Low-Medium Activity',
    commits: { min: 5, max: 20 },
    pullRequests: { min: 3, max: 13 },
    issues: { min: 2, max: 10 },
    comments: { min: 5, max: 20 },
    reviews: { min: 2, max: 10 },
    discussions: { min: 2, max: 7 },
    velocityScore: { min: 2, max: 5 },
    growthRate: { min: 0, max: 30 },
  },
  LOW: {
    name: 'Low Activity',
    commits: { min: 1, max: 9 },
    pullRequests: { min: 1, max: 6 },
    issues: { min: 0, max: 5 },
    comments: { min: 2, max: 12 },
    reviews: { min: 0, max: 5 },
    discussions: { min: 0, max: 3 },
    velocityScore: { min: 0.5, max: 2.5 },
    growthRate: { min: 0, max: 20 },
  },
};

// Helper function to get a random value within a range
export function getRandomInRange(range: ActivityRange): number {
  return Math.floor(Math.random() * (range.max - range.min)) + range.min;
}

// Helper function to get a random float within a range
export function getRandomFloatInRange(range: ActivityRange): number {
  return Math.random() * (range.max - range.min) + range.min;
}

// Get profile by index (cycles through profiles)
export function getProfileByIndex(index: number): ActivityProfile {
  const profiles = Object.values(ACTIVITY_PROFILES);
  return profiles[index % profiles.length];
}

// Constants for other calculations
export const CONTRIBUTION_DATE_RANGES = {
  NEW_CONTRIBUTORS_MAX_DAYS: 30,
  REGULAR_CONTRIBUTORS_MAX_DAYS: 365,
  NEW_CONTRIBUTOR_THRESHOLD_DAYS: 90,
  RISING_STAR_MAX_AGE_DAYS: 180,
  RISING_STAR_MIN_VELOCITY: 10,
  LAST_CONTRIBUTION_MAX_DAYS_AGO: 7,
};

export const SIZE_SCALING = {
  MULTIPLIER: 10,
  MIN_SIZE: 10,
  MAX_SIZE: 100,
};
