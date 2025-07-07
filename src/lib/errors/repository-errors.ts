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

  constructor(repositoryName: string, dataType = 'repository data') {
    super(`No ${dataType} available for ${repositoryName}`);
    this.name = 'NoDataAvailableError';
    this.repositoryName = repositoryName;
    this.dataType = dataType;
  }
}

export interface DataResult<T> {
  data: T;
  status: 'success' | 'large_repository_protected' | 'no_data' | 'error';
  message?: string;
  repositoryName?: string;
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
export function createSuccessResult<T>(data: T): DataResult<T> {
  return {
    data,
    status: 'success'
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