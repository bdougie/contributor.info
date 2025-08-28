import { describe, it, expect } from 'vitest';
import {
  getCheckboxState,
  getHealthStatus,
  getSyncButtonText,
  getProgressiveCaptureText,
} from '../ui-state';

describe('ui-state utilities', () => {
  describe('getCheckboxState', () => {
    it('returns true when all are checked', () => {
      expect(getCheckboxState(true, false)).toBe(true);
      expect(getCheckboxState(true, true)).toBe(true); // allChecked overrides indeterminate
    });

    it('returns indeterminate when some are checked', () => {
      expect(getCheckboxState(false, true)).toBe('indeterminate');
    });

    it('returns false when none are checked', () => {
      expect(getCheckboxState(false, false)).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('returns Error when there is an error', () => {
      expect(getHealthStatus(true, true)).toBe('Error');
      expect(getHealthStatus(true, false)).toBe('Error'); // error overrides enabled state
    });

    it('returns Active when enabled and no error', () => {
      expect(getHealthStatus(false, true)).toBe('Active');
    });

    it('returns Inactive when not enabled and no error', () => {
      expect(getHealthStatus(false, false)).toBe('Inactive');
    });
  });

  describe('getSyncButtonText', () => {
    it('returns Syncing... when syncing is in progress', () => {
      expect(getSyncButtonText(true, true)).toBe('Syncing...');
      expect(getSyncButtonText(true, false)).toBe('Syncing...'); // syncing overrides login state
    });

    it('returns Sync Now when logged in and not syncing', () => {
      expect(getSyncButtonText(false, true)).toBe('Sync Now');
    });

    it('returns Login to Sync when not logged in and not syncing', () => {
      expect(getSyncButtonText(false, false)).toBe('Login to Sync');
    });
  });

  describe('getProgressiveCaptureText', () => {
    it('returns Starting... when triggering', () => {
      expect(getProgressiveCaptureText(true, false)).toBe('Starting...');
      expect(getProgressiveCaptureText(true, true)).toBe('Starting...'); // triggering overrides processing
    });

    it('returns Processing... when processing but not triggering', () => {
      expect(getProgressiveCaptureText(false, true)).toBe('Processing...');
    });

    it('returns Fix Data when neither triggering nor processing', () => {
      expect(getProgressiveCaptureText(false, false)).toBe('Fix Data');
    });
  });
});
