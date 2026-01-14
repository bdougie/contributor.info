// Tour context and hooks
export { TourProvider } from './tour-context';
export { useTour } from './use-tour';

// Tour steps
export { DEFAULT_TOUR_STEPS, getTourStepsByCategory, getTourStepById } from './tour-steps';

// Tour storage utilities
export {
  getTourState,
  saveTourState,
  markTourCompleted,
  markTourDismissed,
  markStepViewed,
  resetTourState,
  shouldShowTour,
} from './tour-storage';

// Tour styles
export { tourStyles, tourLocale, floaterProps } from './tour-styles';

// Types
export type {
  TourStep,
  TourCategory,
  TourState,
  TourContextValue,
  TourProviderProps,
  TourCallbackData,
  TourStyles,
} from './types';
