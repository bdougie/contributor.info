import { useState, useCallback, useEffect, useMemo } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { TourContextValue, TourProviderProps, TourCallbackData, TourStep } from './types';
import { TourContext } from './tour-context-value';
import { DEFAULT_TOUR_STEPS } from './tour-steps';
import { tourStyles, tourLocale, floaterProps } from './tour-styles';
import {
  getTourState,
  markTourCompleted,
  markTourDismissed,
  markStepViewed,
  incrementStartCount,
  resetTourState,
  shouldShowTour,
} from './tour-storage';
import { trackEvent } from '@/lib/posthog-lazy';

/**
 * Provider component for the onboarding tour
 */
export function TourProvider({
  children,
  steps = DEFAULT_TOUR_STEPS,
  autoStart = false,
  autoStartDelay = 2000,
  onComplete,
}: TourProviderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourState, setTourState] = useState(() => getTourState());

  // Auto-start tour for first-time users
  useEffect(() => {
    if (autoStart && shouldShowTour()) {
      const timer = setTimeout(() => {
        setIsRunning(true);
        incrementStartCount();
        trackEvent('onboarding_tour_auto_started', {
          step_count: steps.length,
        });
      }, autoStartDelay);

      return () => clearTimeout(timer);
    }
  }, [autoStart, autoStartDelay, steps.length]);

  const startTour = useCallback(
    (fromStep = 0) => {
      setStepIndex(fromStep);
      setIsRunning(true);
      incrementStartCount();
      trackEvent('onboarding_tour_started', {
        from_step: fromStep,
        step_count: steps.length,
        is_restart: tourState.startCount > 0,
      });
    },
    [steps.length, tourState.startCount]
  );

  const stopTour = useCallback(() => {
    setIsRunning(false);
    trackEvent('onboarding_tour_stopped', {
      at_step: stepIndex,
      step_id: steps[stepIndex]?.id,
    });
  }, [stepIndex, steps]);

  const nextStep = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    }
  }, [stepIndex, steps.length]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  }, [stepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setStepIndex(index);
      }
    },
    [steps.length]
  );

  const resetTour = useCallback(() => {
    resetTourState();
    setTourState(getTourState());
    setStepIndex(0);
    trackEvent('onboarding_tour_reset');
  }, []);

  // Handle Joyride callbacks
  const handleJoyrideCallback = useCallback(
    (data: TourCallbackData) => {
      const { action, index, status, type } = data;
      const currentStep = steps[index] as TourStep | undefined;

      // Track step views
      if (type === EVENTS.STEP_AFTER && currentStep) {
        markStepViewed(currentStep.id);
        trackEvent('onboarding_tour_step_completed', {
          step_id: currentStep.id,
          step_name: currentStep.id.replace(/-/g, ' '),
          step_number: index + 1,
          total_steps: steps.length,
          progress_percentage: Math.round(((index + 1) / steps.length) * 100),
          category: currentStep.category,
        });
      }

      // Handle tour completion
      if (status === STATUS.FINISHED) {
        setIsRunning(false);
        markTourCompleted();
        setTourState(getTourState());
        trackEvent('onboarding_tour_completed', {
          total_steps: steps.length,
          steps_completed: steps.length,
          completion_rate: 100,
        });
        // Call the completion callback to handle navigation
        onComplete?.();
        return;
      }

      // Handle tour skip/close (abandonment)
      if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
        setIsRunning(false);
        markTourDismissed();
        setTourState(getTourState());
        const stepsCompleted = index;
        const completionRate = Math.round((stepsCompleted / steps.length) * 100);
        trackEvent('onboarding_tour_abandoned', {
          total_steps: steps.length,
          steps_completed: stepsCompleted,
          completion_rate: completionRate,
          abandoned_at_step: index,
          abandoned_step_id: currentStep?.id,
          abandoned_step_name: currentStep?.id?.replace(/-/g, ' '),
          action: action === ACTIONS.CLOSE ? 'closed' : 'skipped',
        });
        return;
      }

      // Handle navigation
      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) {
          if (index < steps.length - 1) {
            setStepIndex(index + 1);
          }
        } else if (action === ACTIONS.PREV) {
          if (index > 0) {
            setStepIndex(index - 1);
          }
        }
      }

      // Handle target not found
      if (type === EVENTS.TARGET_NOT_FOUND) {
        // Skip to next step if target not found, or complete if at last step
        if (index < steps.length - 1) {
          setStepIndex(index + 1);
        } else {
          // Last step target not found, complete the tour
          setIsRunning(false);
          markTourCompleted();
          setTourState(getTourState());
        }
        trackEvent('onboarding_tour_target_not_found', {
          step_id: currentStep?.id,
          step_index: index,
        });
      }
    },
    [steps, onComplete]
  );

  const contextValue = useMemo<TourContextValue>(
    () => ({
      isRunning,
      stepIndex,
      steps,
      startTour,
      stopTour,
      nextStep,
      prevStep,
      goToStep,
      resetTour,
      isCompleted: tourState.completed,
      isDismissed: tourState.dismissed,
    }),
    [
      isRunning,
      stepIndex,
      steps,
      startTour,
      stopTour,
      nextStep,
      prevStep,
      goToStep,
      resetTour,
      tourState.completed,
      tourState.dismissed,
    ]
  );

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton={false}
        run={isRunning}
        scrollToFirstStep
        showProgress
        showSkipButton
        stepIndex={stepIndex}
        steps={steps}
        styles={tourStyles}
        locale={tourLocale}
        floaterProps={floaterProps}
        disableOverlayClose={false}
        spotlightClicks={true}
        disableScrolling={false}
      />
    </TourContext.Provider>
  );
}
