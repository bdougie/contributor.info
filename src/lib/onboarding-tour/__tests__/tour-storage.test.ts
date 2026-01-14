import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTourState,
  saveTourState,
  markTourCompleted,
  markTourDismissed,
  markStepViewed,
  resetTourState,
  shouldShowTour,
  incrementStartCount,
} from '../tour-storage';

describe('tour-storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getTourState', () => {
    it('returns default state when localStorage is empty', () => {
      const state = getTourState();
      expect(state).toEqual({
        completed: false,
        viewedSteps: [],
        dismissed: false,
        startCount: 0,
      });
    });

    it('returns stored state when present', () => {
      const storedState = {
        completed: true,
        completedAt: 1234567890,
        viewedSteps: ['step1', 'step2'],
        dismissed: false,
        startCount: 2,
      };
      localStorage.setItem('contributor-info-tour-state', JSON.stringify(storedState));

      const state = getTourState();
      expect(state).toEqual(storedState);
    });

    it('handles invalid JSON gracefully', () => {
      localStorage.setItem('contributor-info-tour-state', 'invalid-json');

      const state = getTourState();
      expect(state).toEqual({
        completed: false,
        viewedSteps: [],
        dismissed: false,
        startCount: 0,
      });
    });
  });

  describe('saveTourState', () => {
    it('saves partial state updates', () => {
      saveTourState({ completed: true });

      const state = getTourState();
      expect(state.completed).toBe(true);
      expect(state.viewedSteps).toEqual([]);
    });

    it('merges with existing state', () => {
      saveTourState({ completed: true });
      saveTourState({ viewedSteps: ['step1'] });

      const state = getTourState();
      expect(state.completed).toBe(true);
      expect(state.viewedSteps).toEqual(['step1']);
    });
  });

  describe('markTourCompleted', () => {
    it('marks tour as completed with timestamp', () => {
      markTourCompleted();

      const state = getTourState();
      expect(state.completed).toBe(true);
      expect(state.completedAt).toBeDefined();
      expect(typeof state.completedAt).toBe('number');
    });
  });

  describe('markTourDismissed', () => {
    it('marks tour as dismissed with timestamp', () => {
      markTourDismissed();

      const state = getTourState();
      expect(state.dismissed).toBe(true);
      expect(state.dismissedAt).toBeDefined();
      expect(typeof state.dismissedAt).toBe('number');
    });
  });

  describe('markStepViewed', () => {
    it('adds step to viewedSteps array', () => {
      markStepViewed('step1');
      markStepViewed('step2');

      const state = getTourState();
      expect(state.viewedSteps).toEqual(['step1', 'step2']);
    });

    it('does not add duplicate steps', () => {
      // Explicitly reset to ensure clean state
      resetTourState();

      markStepViewed('step1');
      markStepViewed('step1');

      const state = getTourState();
      expect(state.viewedSteps).toEqual(['step1']);
    });
  });

  describe('incrementStartCount', () => {
    it('increments start count', () => {
      incrementStartCount();
      expect(getTourState().startCount).toBe(1);

      incrementStartCount();
      expect(getTourState().startCount).toBe(2);
    });
  });

  describe('resetTourState', () => {
    it('resets tour state while preserving startCount', () => {
      // Start with a clean state
      localStorage.clear();

      markTourCompleted();
      markStepViewed('step1');
      incrementStartCount();

      const beforeReset = getTourState();
      const countBeforeReset = beforeReset.startCount;

      resetTourState();

      const state = getTourState();
      expect(state.completed).toBe(false);
      expect(state.completedAt).toBeUndefined();
      expect(state.viewedSteps).toEqual([]);
      expect(state.dismissed).toBe(false);
      expect(state.dismissedAt).toBeUndefined();
      expect(state.startCount).toBe(countBeforeReset); // Verify startCount is preserved
    });
  });

  describe('shouldShowTour', () => {
    it('returns true for new users', () => {
      expect(shouldShowTour()).toBe(true);
    });

    it('returns false if tour is completed', () => {
      markTourCompleted();
      expect(shouldShowTour()).toBe(false);
    });

    it('returns false if tour is dismissed', () => {
      markTourDismissed();
      expect(shouldShowTour()).toBe(false);
    });
  });
});
