import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import type { TourContextValue, TourProviderProps } from './types';
import { TourContext } from './tour-context-value';
import { DEFAULT_TOUR_STEPS } from './tour-steps';
import { getTourState, incrementStartCount, resetTourState, shouldShowTour } from './tour-storage';
import { trackEvent } from '@/lib/posthog-lazy';

// Lazy load the entire Joyride wrapper to avoid impacting initial page load (~40KB savings)
const LazyJoyrideWrapper = lazy(() =>
  import('./lazy-joyride-wrapper').then((mod) => ({ default: mod.LazyJoyrideWrapper }))
);

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

  // Callbacks for the lazy-loaded Joyride wrapper
  const handleStepChange = useCallback((index: number) => {
    setStepIndex(index);
  }, []);

  const handleTourComplete = useCallback(() => {
    setIsRunning(false);
    setTourState(getTourState());
    onComplete?.();
  }, [onComplete]);

  const handleTourStop = useCallback(() => {
    setIsRunning(false);
    setTourState(getTourState());
  }, []);

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
      {/* Only load Joyride when tour is running to avoid impacting initial bundle */}
      {isRunning && (
        <Suspense fallback={null}>
          <LazyJoyrideWrapper
            isRunning={isRunning}
            stepIndex={stepIndex}
            steps={steps}
            onStepChange={handleStepChange}
            onComplete={handleTourComplete}
            onStop={handleTourStop}
          />
        </Suspense>
      )}
    </TourContext.Provider>
  );
}
