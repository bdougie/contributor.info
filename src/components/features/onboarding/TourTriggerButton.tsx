import { useCallback, useEffect, useRef } from 'react';
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
  const pendingTourRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Start tour when we arrive at the tour page
  useEffect(() => {
    if (pendingTourRef.current && location.pathname === TOUR_START_PATH) {
      pendingTourRef.current = false;
      // Use a short delay to ensure the page is fully rendered
      timeoutRef.current = window.setTimeout(() => {
        startTour(0);
        timeoutRef.current = null;
      }, 300);
    }
  }, [location.pathname, startTour]);

  const handleStartTour = useCallback(() => {
    const isOnTourPage = location.pathname === TOUR_START_PATH;

    if (isOnTourPage) {
      // Already on the tour page, start immediately
      startTour(0);
    } else {
      // Navigate first, then start tour when we arrive
      pendingTourRef.current = true;
      navigate(TOUR_START_PATH);
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
