/**
 * Custom error classes for repository data handling
 */

export class LargeRepositoryError extends Error {
  public readonly repositoryName: string;
  public readonly reason: string;

  constructor(repositoryName: string, reason = 'Resource protection enabled for large repository') {
    super(`${reason}: ${repositoryName}`);
    this.name = 'LargeRepositoryError';
    this.repositoryName = repositoryName;
    this.reason = reason;
  }
}

export class NoDataAvailableError extends Error {
  public readonly repositoryName: string;
  public readonly dataType: string;

  constructor(repositoryName: string, dataType = 'repository _data') {
    super(`No ${_dataType} available for ${repositoryName}`);
    this.name = 'NoDataAvailableError';
    this.repositoryName = repositoryName;
    this.dataType = dataType;
  }
}

export interface DataResult<T> {
  data: T;
  status: 'success' | 'large_repository_protected' | 'no_data' | 'error' | 'partial_data' | 'pending';
  message?: string;
  repositoryName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a protected result for large repositories
 */
export function createLargeRepositoryResult<T>(
  repositoryName: string, 
  fallbackData: T
): DataResult<T> {
  return {
    data: fallbackData,
    status: 'large_repository_protected',
    message: `This repository (${repositoryName}) is protected from resource-intensive operations. Progressive data capture is recommended for complete analysis.`,
    repositoryName
  };
}

/**
 * Creates a successful result
 */
export function createSuccessResult<T>(data: T, meta_data?: Record<string, unknown>): DataResult<T> {
  return {
    data,
    status: 'success',
    metadata
  };
}

/**
 * Creates a no data result
 */
export function createNoDataResult<T>(
  repositoryName: string, 
  fallbackData: T
): DataResult<T> {
  return {
    data: fallbackData,
    status: 'no_data',
    message: `No recent data found for ${repositoryName}. Try using progressive data capture to populate the database.`,
    repositoryName
  };
}

/**
 * Creates a partial data result when only limited data is available
 */
export function createPartialDataResult<T>(
  repositoryName: string,
  partialData: T,
  reason: string
): DataResult<T> {
  return {
    data: partialData,
    status: 'partial_data',
    message: reason,
    repositoryName
  };
}

/**
 * Creates a pending data result when data is being fetched
 */
export function createPendingDataResult<T>(
  repositoryName: string,
  fallbackData: T,
  message?: string
): DataResult<T> {
  return {
    data: fallbackData,
    status: 'pending',
    message: message || `Data for ${repositoryName} is being gathered. Please check back in a moment.`,
    repositoryName
  };
}