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