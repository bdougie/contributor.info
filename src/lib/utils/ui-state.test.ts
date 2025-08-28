import { describe, it, expect } from 'vitest';
import { getCheckboxState } from './ui-state';

describe('getCheckboxState', () => {
  it('should return true when all items are checked', () => {
    expect(getCheckboxState(true, false)).toBe(true);
    expect(getCheckboxState(true, true)).toBe(true); // allChecked takes priority
  });

  it('should return indeterminate when some items are checked', () => {
    expect(getCheckboxState(false, true)).toBe('indeterminate');
  });

  it('should return false when no items are checked', () => {
    expect(getCheckboxState(false, false)).toBe(false);
  });
});