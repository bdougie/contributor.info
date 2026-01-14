import type { Step, CallBackProps, Styles } from 'react-joyride';

/**
 * Tour step definition with typed targets
 */
export interface TourStep extends Step {
  /** Unique identifier for this step */
  id: string;
  /** Category of this step for filtering */
  category?: TourCategory;
}

/**
 * Categories for grouping tour steps
 */
export type TourCategory = 'navigation' | 'workspace' | 'repository' | 'settings' | 'collaboration';

/**
 * Tour state stored in localStorage
 */
export interface TourState {
  /** Whether the tour has been completed */
  completed: boolean;
  /** Timestamp of completion */
  completedAt?: number;
  /** Steps that have been viewed */
  viewedSteps: string[];
  /** Whether user dismissed the tour */
  dismissed: boolean;
  /** Timestamp of last dismissal */
  dismissedAt?: number;
  /** Number of times tour was started */
  startCount: number;
}

/**
 * Tour context value
 */
export interface TourContextValue {
  /** Whether the tour is currently running */
  isRunning: boolean;
  /** Current step index */
  stepIndex: number;
  /** All tour steps */
  steps: TourStep[];
  /** Start the tour */
  startTour: (fromStep?: number) => void;
  /** Stop the tour */
  stopTour: () => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
  /** Skip to a specific step */
  goToStep: (index: number) => void;
  /** Reset tour state (for retaking) */
  resetTour: () => void;
  /** Check if tour has been completed */
  isCompleted: boolean;
  /** Check if tour was dismissed */
  isDismissed: boolean;
}

/**
 * Props for the TourProvider component
 */
export interface TourProviderProps {
  children: React.ReactNode;
  /** Custom steps to use instead of default */
  steps?: TourStep[];
  /** Whether to auto-start for first-time users */
  autoStart?: boolean;
  /** Delay before auto-starting (ms) */
  autoStartDelay?: number;
  /** Callback when tour is completed */
  onComplete?: () => void;
}

/**
 * Tour callback data with proper typing
 */
export type TourCallbackData = CallBackProps;

/**
 * Custom styles for the tour
 */
export type TourStyles = Partial<Styles>;
