/**
 * Comprehensive error type system for progressive data loading
 * Based on the requirements from issue #286
 */

export type LoadingStage = 'critical' | 'full' | 'enhancement';

export type ErrorType = 'network' | 'permission' | 'validation' | 'timeout' | 'rate_limit';

/**
 * Core loading error interface
 */
export interface LoadingError extends Error {
  stage: LoadingStage;
  type: ErrorType;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
  context?: {
    owner?: string;
    repo?: string;
    timeRange?: string;
    apiEndpoint?: string;
  };
  recoveryOptions?: RecoveryOption[];
}

/**
 * Recovery options that can be presented to users
 */
export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  action: RecoveryAction;
  priority: 'high' | 'medium' | 'low';
}

export type RecoveryAction =
  | 'retry'
  | 'refresh_auth'
  | 'clear_cache'
  | 'contact_support'
  | 'use_partial_data'
  | 'switch_timerange';

/**
 * Error boundary state for tracking errors across stages
 */
export interface ErrorBoundaryState {
  errors: Record<LoadingStage, LoadingError | null>;
  partialData: {
    critical?: unknown;
    full?: unknown;
    enhancement?: unknown;
  };
  recoveryAttempts: Record<string, number>;
  lastRecoveryTime: Record<string, number>;
}

/**
 * Predefined error configurations for common scenarios
 */
export const ERROR_CONFIGS: Record<string, Omit<LoadingError, 'message' | 'name' | 'stack'>> = {
  NETWORK_TIMEOUT: {
    stage: 'critical',
    type: 'timeout',
    retryable: true,
    userMessage: 'The request timed out. This might be due to slow network conditions.',
    technicalDetails: 'Network request exceeded timeout threshold',
    recoveryOptions: [
      {
        id: 'retry',
        label: 'Try Again',
        description: 'Retry the request',
        action: 'retry',
        priority: 'high',
      },
      {
        id: 'check_connection',
        label: 'Check Connection',
        description: 'Verify your internet connection and try again',
        action: 'retry',
        priority: 'medium',
      },
    ],
  },

  PERMISSION_DENIED: {
    stage: 'critical',
    type: 'permission',
    retryable: false,
    userMessage: 'Access denied. You may need to sign in or this repository might be private.',
    technicalDetails: 'HTTP 401/403 - Authentication or authorization failed',
    recoveryOptions: [
      {
        id: 'refresh_auth',
        label: 'Sign In Again',
        description: 'Refresh your authentication',
        action: 'refresh_auth',
        priority: 'high',
      },
      {
        id: 'contact_support',
        label: 'Get Help',
        description: 'Contact support if you believe this is an error',
        action: 'contact_support',
        priority: 'low',
      },
    ],
  },

  RATE_LIMIT_EXCEEDED: {
    stage: 'full',
    type: 'rate_limit',
    retryable: true,
    userMessage: 'Too many requests. Please wait a moment and try again.',
    technicalDetails: 'GitHub API rate limit exceeded',
    recoveryOptions: [
      {
        id: 'wait_retry',
        label: 'Wait & Retry',
        description: 'Wait for rate limit to reset',
        action: 'retry',
        priority: 'high',
      },
      {
        id: 'use_partial',
        label: 'Use Available Data',
        description: 'Continue with the data we already have',
        action: 'use_partial_data',
        priority: 'medium',
      },
    ],
  },

  VALIDATION_ERROR: {
    stage: 'critical',
    type: 'validation',
    retryable: false,
    userMessage: 'Invalid repository information. Please check the owner and repository name.',
    technicalDetails: 'Repository owner or name validation failed',
    recoveryOptions: [
      {
        id: 'check_repo',
        label: 'Check Repository',
        description: 'Verify the repository owner and name are correct',
        action: 'contact_support',
        priority: 'high',
      },
    ],
  },

  ENHANCEMENT_FAILED: {
    stage: 'enhancement',
    type: 'network',
    retryable: true,
    userMessage: 'Some additional data could not be loaded, but core functionality is available.',
    technicalDetails: 'Enhancement stage data fetching failed',
    recoveryOptions: [
      {
        id: 'continue',
        label: 'Continue',
        description: 'Use the available data without enhancements',
        action: 'use_partial_data',
        priority: 'high',
      },
      {
        id: 'retry_enhancement',
        label: 'Retry Enhancement',
        description: 'Try loading the additional data again',
        action: 'retry',
        priority: 'medium',
      },
    ],
  },
};

/**
 * Factory function to create LoadingError instances
 */
export function createLoadingError(
  configKey: keyof typeof ERROR_CONFIGS,
  message: string,
  context?: LoadingError['context'],
): LoadingError {
  const config = ERROR_CONFIGS[configKey];

  const error = new Error(message) as LoadingError;

  // Copy properties from config
  error.stage = config.stage;
  error.type = config.type;
  error.retryable = config.retryable;
  error.userMessage = config.userMessage;
  error.technicalDetails = config.technicalDetails;
  error.recoveryOptions = config.recoveryOptions;
  error.context = context;

  return error;
}

/**
 * Helper function to determine if an error is recoverable in a different stage
 */
export function canRecoverInNextStage(error: LoadingError): boolean {
  // Critical stage failures are hard to recover from
  if (error.stage === 'critical') {
    return error.type === 'timeout' || error.type === 'network';
  }

  // Full stage failures can often be recovered in enhancement stage
  if (error.stage === 'full') {
    return error.type !== 'validation' && error.type !== 'permission';
  }

  // Enhancement stage failures don't block core functionality
  return false;
}

/**
 * Helper function to get retry delay based on error type and attempt count
 */
export function getRetryDelay(error: LoadingError, attemptCount: number): number {
  const baseDelays = {
    network: 1000, // 1s base delay for network errors
    timeout: 2000, // 2s base delay for timeouts
    rate_limit: 5000, // 5s base delay for rate limits
    permission: 0, // No retry for permission errors
    validation: 0, // No retry for validation errors
  };

  const baseDelay = baseDelays[error.type];

  if (baseDelay === 0 || !error.retryable) {
    return 0;
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attemptCount - 1);
  const jitter = Math.random() * 0.3; // 30% jitter

  return Math.min(exponentialDelay * (1 + jitter), 30000); // Max 30s delay
}
