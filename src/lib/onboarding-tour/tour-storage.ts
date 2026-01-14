import type { TourState } from './types';

const STORAGE_KEY = 'contributor-info-tour-state';

/**
 * Default tour state for new users
 */
const DEFAULT_TOUR_STATE: TourState = {
  completed: false,
  viewedSteps: [],
  dismissed: false,
  startCount: 0,
};

/**
 * Get the current tour state from localStorage
 */
export function getTourState(): TourState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_TOUR_STATE };
    }
    const parsed = JSON.parse(stored) as Partial<TourState>;
    return {
      ...DEFAULT_TOUR_STATE,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_TOUR_STATE };
  }
}

/**
 * Save tour state to localStorage
 */
export function saveTourState(state: Partial<TourState>): void {
  try {
    const current = getTourState();
    const updated: TourState = {
      ...current,
      ...state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Mark the tour as completed
 */
export function markTourCompleted(): void {
  saveTourState({
    completed: true,
    completedAt: Date.now(),
  });
}

/**
 * Mark the tour as dismissed
 */
export function markTourDismissed(): void {
  saveTourState({
    dismissed: true,
    dismissedAt: Date.now(),
  });
}

/**
 * Mark a step as viewed
 */
export function markStepViewed(stepId: string): void {
  const current = getTourState();
  if (!current.viewedSteps.includes(stepId)) {
    saveTourState({
      viewedSteps: [...current.viewedSteps, stepId],
    });
  }
}

/**
 * Increment the start count
 */
export function incrementStartCount(): void {
  const current = getTourState();
  saveTourState({
    startCount: current.startCount + 1,
  });
}

/**
 * Reset tour state (for retaking the tour)
 */
export function resetTourState(): void {
  saveTourState({
    completed: false,
    completedAt: undefined,
    viewedSteps: [],
    dismissed: false,
    dismissedAt: undefined,
  });
}

/**
 * Check if user should see the tour
 * Returns true if:
 * - Tour has never been completed
 * - Tour has not been dismissed
 */
export function shouldShowTour(): boolean {
  const state = getTourState();
  return !state.completed && !state.dismissed;
}
