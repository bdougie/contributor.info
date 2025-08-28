/**
 * Utility functions for UI state management to replace nested ternary expressions
 */

/**
 * Get checkbox checked state for indeterminate handling
 * Maps all-checked/indeterminate/none-checked states to proper checkbox values
 * 
 * @param allChecked - Whether all items are selected
 * @param indeterminate - Whether some (but not all) items are selected
 * @returns Checkbox state: true, false, or 'indeterminate'
 * 
 * @example
 * getCheckboxState(true, false) // returns true (all checked)
 * getCheckboxState(false, true) // returns 'indeterminate' (some checked)
 * getCheckboxState(false, false) // returns false (none checked)
 */
export const getCheckboxState = (
  allChecked: boolean, 
  indeterminate: boolean
): boolean | 'indeterminate' => {
  if (allChecked) return true;
  if (indeterminate) return 'indeterminate';
  return false;
};

/**
 * Get health status text based on error and enabled state
 * Used for monitoring displays and status indicators
 * 
 * @param hasError - Whether the component has an error state
 * @param isEnabled - Whether the component is active/enabled
 * @returns Status text: 'Error', 'Active', or 'Inactive'
 * 
 * @example
 * getHealthStatus(true, true) // returns 'Error' (error overrides enabled)
 * getHealthStatus(false, true) // returns 'Active'
 * getHealthStatus(false, false) // returns 'Inactive'
 */
export const getHealthStatus = (hasError: boolean, isEnabled: boolean): string => {
  if (hasError) return 'Error';
  if (isEnabled) return 'Active';
  return 'Inactive';
};

/**
 * Get sync button text based on state and authentication
 * Provides appropriate button text for different sync scenarios
 * 
 * @param isSyncing - Whether a sync operation is currently in progress
 * @param isLoggedIn - Whether the user is authenticated
 * @returns Button text: 'Syncing...', 'Sync Now', or 'Login to Sync'
 * 
 * @example
 * getSyncButtonText(true, true) // returns 'Syncing...' (operation in progress)
 * getSyncButtonText(false, true) // returns 'Sync Now' (ready to sync)
 * getSyncButtonText(false, false) // returns 'Login to Sync' (needs auth)
 */
export const getSyncButtonText = (isSyncing: boolean, isLoggedIn: boolean): string => {
  if (isSyncing) return 'Syncing...';
  if (isLoggedIn) return 'Sync Now';
  return 'Login to Sync';
};

/**
 * Get progressive capture button text based on processing state
 * Provides appropriate button text for data processing operations
 * 
 * @param isTriggering - Whether the process is starting/triggering
 * @param isProcessing - Whether the process is currently running
 * @returns Button text: 'Starting...', 'Processing...', or 'Fix Data'
 * 
 * @example
 * getProgressiveCaptureText(true, false) // returns 'Starting...' (initializing)
 * getProgressiveCaptureText(false, true) // returns 'Processing...' (running)
 * getProgressiveCaptureText(false, false) // returns 'Fix Data' (ready)
 */
export const getProgressiveCaptureText = (
  isTriggering: boolean,
  isProcessing: boolean
): string => {
  if (isTriggering) return 'Starting...';
  if (isProcessing) return 'Processing...';
  return 'Fix Data';
};