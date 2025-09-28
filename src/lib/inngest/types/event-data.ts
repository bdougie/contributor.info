/**
 * Type definitions for Inngest event data to ensure consistency
 * across the application and prevent missing required fields
 */

export interface RepositorySyncEventData {
  repositoryId: string;
  repositoryName: string;
  days: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  jobId?: string;
  maxItems?: number;
}

export interface PRDetailsEventData {
  repositoryId: string;
  prNumbers: number[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  jobId?: string;
}

export interface PRReviewsEventData {
  repositoryId: string;
  prNumber: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  jobId?: string;
}

export interface PRCommentsEventData {
  repositoryId: string;
  prNumber: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  jobId?: string;
}

export interface IssueCommentsEventData {
  repositoryId: string;
  issueNumber: number;
  issueId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  jobId?: string;
}

export interface CommitCaptureEventData {
  repositoryId: string;
  repositoryName: string;
  days: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  forceInitial?: boolean;
  maxCommits?: number;
  jobId?: string;
}

/**
 * Helper function to validate repository sync event data
 */
export function validateRepositorySyncEventData(
  data: Partial<RepositorySyncEventData>
): RepositorySyncEventData {
  if (!data.repositoryId) {
    throw new Error('repositoryId is required for repository sync events');
  }
  if (!data.repositoryName) {
    throw new Error('repositoryName is required for repository sync events');
  }

  return {
    repositoryId: data.repositoryId,
    repositoryName: data.repositoryName,
    days: data.days ?? 7,
    priority: data.priority ?? 'medium',
    reason: data.reason ?? 'automatic',
    jobId: data.jobId,
    maxItems: data.maxItems,
  };
}

/**
 * Maps hybrid queue manager data to Inngest event data
 */
export function mapQueueDataToEventData(
  jobType: string,
  queueData: {
    repositoryId: string;
    repositoryName: string;
    timeRange?: number;
    triggerSource?: string;
    maxItems?: number;
    jobId?: string;
    prNumbers?: number[];
    prNumber?: number;
    forceInitial?: boolean;
    maxCommits?: number;
  }
): RepositorySyncEventData | PRDetailsEventData | PRReviewsEventData | PRCommentsEventData | CommitCaptureEventData {
  const baseData = {
    repositoryId: queueData.repositoryId,
    priority: 'medium' as const,
    jobId: queueData.jobId,
  };

  switch (jobType) {
    case 'historical-pr-sync':
    case 'recent-prs':
      return validateRepositorySyncEventData({
        ...baseData,
        repositoryName: queueData.repositoryName,
        days: queueData.timeRange ?? 7,
        reason: queueData.triggerSource ?? 'automatic',
        maxItems: queueData.maxItems ? Math.min(queueData.maxItems, 50) : 50,
      });

    case 'pr-details':
      if (!queueData.prNumbers) {
        throw new Error('prNumbers is required for PR details events');
      }
      return {
        ...baseData,
        prNumbers: queueData.prNumbers,
        reason: queueData.triggerSource ?? 'automatic',
      } as PRDetailsEventData;

    case 'reviews':
      if (!queueData.prNumber) {
        throw new Error('prNumber is required for PR reviews events');
      }
      return {
        ...baseData,
        prNumber: queueData.prNumber,
      } as PRReviewsEventData;

    case 'comments':
      if (!queueData.prNumber) {
        throw new Error('prNumber is required for PR comments events');
      }
      return {
        ...baseData,
        prNumber: queueData.prNumber,
      } as PRCommentsEventData;

    case 'commits':
    case 'commit-capture':
      return {
        ...baseData,
        repositoryName: queueData.repositoryName,
        days: queueData.timeRange ?? 7,
        forceInitial: queueData.forceInitial,
        maxCommits: queueData.maxCommits,
      } as CommitCaptureEventData;

    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}
