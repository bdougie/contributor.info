/**
 * Error classification utilities for consistent analytics
 * Centralizes error type detection logic across the application
 */

export type TrackingErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Classifies tracking errors for consistent analytics categorization
 * Uses case-insensitive pattern matching for reliable classification
 *
 * @param error - The error to classify
 * @returns The error type category
 */
export function classifyTrackingError(error: Error): TrackingErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }

  if (message.includes('auth') || message.includes('login')) {
    return 'AUTH_ERROR';
  }

  if (message.includes('permission') || message.includes('forbidden')) {
    return 'PERMISSION_ERROR';
  }

  if (message.includes('not found')) {
    return 'NOT_FOUND_ERROR';
  }

  return 'UNKNOWN_ERROR';
}
