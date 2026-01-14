import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { TourCallbackData, TourStep } from './types';
import { tourStyles, tourLocale, floaterProps } from './tour-styles';
import { markTourCompleted, markTourDismissed, markStepViewed } from './tour-storage';
import { trackEvent } from '@/lib/posthog-lazy';

interface LazyJoyrideWrapperProps {
  isRunning: boolean;
  stepIndex: number;
  steps: TourStep[];
  onStepChange: (index: number) => void;
  onComplete: () => void;
  onStop: () => void;
}

/**
 * Lazy-loaded Joyride wrapper component
 * This component is loaded on-demand when the tour starts to avoid
 * impacting initial page load performance (~40KB savings)
 */
export function LazyJoyrideWrapper({
  isRunning,
  stepIndex,
  steps,
  onStepChange,
  onComplete,
  onStop,
}: LazyJoyrideWrapperProps) {
  const handleJoyrideCallback = (data: TourCallbackData) => {
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
      markTourCompleted();
      trackEvent('onboarding_tour_completed', {
        total_steps: steps.length,
        steps_completed: steps.length,
        completion_rate: 100,
      });
      onComplete();
      return;
    }

    // Handle tour skip/close (abandonment)
    if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      markTourDismissed();
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
      onStop();
      return;
    }

    // Handle navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        onStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        onStepChange(index - 1);
      }
    }

    // Handle target not found
    if (type === EVENTS.TARGET_NOT_FOUND) {
      // Skip to next step if target not found
      onStepChange(index + 1);
      trackEvent('onboarding_tour_target_not_found', {
        step_id: currentStep?.id,
        step_index: index,
      });
    }
  };

  return (
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
  );
}
