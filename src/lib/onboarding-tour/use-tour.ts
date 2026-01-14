import { useContext } from 'react';
import { TourContext } from './tour-context-value';
import type { TourContextValue } from './types';

/**
 * Hook to access tour context
 */
export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
