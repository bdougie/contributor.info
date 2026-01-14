import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { HelpCircle } from '@/components/ui/icon';
import { useTour } from '@/lib/onboarding-tour';

/** The repository page where the tour starts */
const TOUR_START_PATH = '/continuedev/continue';

interface TourTriggerButtonProps {
  variant?: 'default' | 'ghost' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

/**
 * Button to manually start the onboarding tour
 * Navigates to /continuedev/continue before starting
 */
export function TourTriggerButton({
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = true,
}: TourTriggerButtonProps) {
  const { startTour, isRunning, isCompleted } = useTour();
  const navigate = useNavigate();
  const location = useLocation();

  const handleStartTour = useCallback(() => {
    const isOnTourPage = location.pathname === TOUR_START_PATH;

    if (isOnTourPage) {
      // Already on the tour page, start immediately
      startTour(0);
    } else {
      // Navigate first, then start tour after a short delay for page load
      navigate(TOUR_START_PATH);
      setTimeout(() => startTour(0), 500);
    }
  }, [location.pathname, navigate, startTour]);

  if (isRunning) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleStartTour}
      className={className}
      aria-label={isCompleted ? 'Retake the tour' : 'Take a tour'}
    >
      <HelpCircle className="h-4 w-4" />
      {showLabel && <span className="ml-2">{isCompleted ? 'Retake Tour' : 'Take a Tour'}</span>}
    </Button>
  );
}
