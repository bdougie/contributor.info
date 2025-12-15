/**
 * Shared types for repository API endpoints
 */

/**
 * Response from the repository tracking API endpoint
 */
export interface TrackRepositoryResponse {
  success: boolean;
  eventId?: string;
  message?: string;
}

/**
 * Response from the repository status API endpoint
 */
export interface RepositoryStatusResponse {
  success: boolean;
  hasData: boolean;
  status: 'not_found' | 'pending' | 'syncing' | 'ready' | 'error';
  repository?: {
    id: string;
    owner: string;
    name: string;
    createdAt: string;
    lastUpdatedAt: string | null;
  };
  dataAvailability?: {
    hasCommits: boolean;
    hasPullRequests: boolean;
    hasContributors: boolean;
    commitCount: number;
    prCount: number;
    contributorCount: number;
  };
  message?: string;
  error?: string;
}

export type RepositoryStatus = RepositoryStatusResponse['status'];
