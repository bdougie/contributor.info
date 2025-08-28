/**
 * Utility functions for label and array patterns to replace nested ternary expressions
 */

/**
 * Get labels based on index modulo pattern
 * Provides consistent label assignment for demo/story data
 *
 * @param index - Array index or item position
 * @returns Array of label strings based on index pattern
 *
 * @example
 * getLabelsByIndex(0) // returns ['bug', 'high-priority'] (index % 3 === 0)
 * getLabelsByIndex(1) // returns ['enhancement'] (index % 2 === 0)
 * getLabelsByIndex(2) // returns [] (default case)
 * getLabelsByIndex(3) // returns ['bug', 'high-priority'] (index % 3 === 0)
 */
export const getLabelsByIndex = (index: number): string[] => {
  if (index % 3 === 0) return ['bug', 'high-priority'];
  if (index % 2 === 0) return ['enhancement'];
  return [];
};

/**
 * Get PR state by index pattern for demo data
 * Provides varied PR states for story/demo content
 *
 * @param index - Array index or item position
 * @returns PR state string based on index pattern
 *
 * @example
 * getPRStateByIndex(0) // returns 'open' (index % 3 === 0)
 * getPRStateByIndex(1) // returns 'merged' (index % 2 === 0)
 * getPRStateByIndex(2) // returns 'closed' (default case)
 */
export const getPRStateByIndex = (index: number): 'open' | 'merged' | 'closed' => {
  if (index % 3 === 0) return 'open';
  if (index % 2 === 0) return 'merged';
  return 'closed';
};

/**
 * Get contributor role by index pattern for demo data
 * Provides varied contributor roles for story/demo content
 *
 * @param index - Array index or item position
 * @returns Role string based on index pattern
 *
 * @example
 * getRoleByIndex(0) // returns 'maintainer' (index % 4 === 0)
 * getRoleByIndex(1) // returns 'contributor' (index % 3 === 0)
 * getRoleByIndex(2) // returns 'reviewer' (index % 2 === 0)
 * getRoleByIndex(3) // returns 'user' (default case)
 */
export const getRoleByIndex = (index: number): string => {
  if (index % 4 === 0) return 'maintainer';
  if (index % 3 === 0) return 'contributor';
  if (index % 2 === 0) return 'reviewer';
  return 'user';
};

/**
 * Get priority by index pattern for demo data
 * Provides varied priorities for story/demo content
 *
 * @param index - Array index or item position
 * @returns Priority string based on index pattern
 *
 * @example
 * getPriorityByIndex(0) // returns 'high' (index % 5 === 0)
 * getPriorityByIndex(1) // returns 'medium' (index % 3 === 0)
 * getPriorityByIndex(2) // returns 'low' (index % 2 === 0)
 * getPriorityByIndex(3) // returns 'normal' (default case)
 */
export const getPriorityByIndex = (index: number): string => {
  if (index % 5 === 0) return 'high';
  if (index % 3 === 0) return 'medium';
  if (index % 2 === 0) return 'low';
  return 'normal';
};
