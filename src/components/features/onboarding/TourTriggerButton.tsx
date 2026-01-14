import { Button } from '@/components/ui/button';
import { HelpCircle } from '@/components/ui/icon';
import { useTour } from '@/lib/onboarding-tour';

interface TourTriggerButtonProps {
  variant?: 'default' | 'ghost' | 'outline' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

/**
 * Button to manually start the onboarding tour
 */
export function TourTriggerButton({
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = true,
}: TourTriggerButtonProps) {
  const { startTour, isRunning, isCompleted } = useTour();

  if (isRunning) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => startTour(0)}
      className={className}
      aria-label={isCompleted ? 'Retake the tour' : 'Take a tour'}
    >
      <HelpCircle className="h-4 w-4" />
      {showLabel && <span className="ml-2">{isCompleted ? 'Retake Tour' : 'Take a Tour'}</span>}
    </Button>
  );
}
