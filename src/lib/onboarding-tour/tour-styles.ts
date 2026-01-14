import type { TourStyles } from './types';

/**
 * Custom styles for the onboarding tour
 * These styles match the contributor.info design system
 */
export const tourStyles: TourStyles = {
  options: {
    // Use CSS variables for theme-aware colors
    arrowColor: 'hsl(var(--popover))',
    backgroundColor: 'hsl(var(--popover))',
    primaryColor: 'hsl(var(--primary))',
    textColor: 'hsl(var(--popover-foreground))',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '0.5rem',
    padding: '1rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  tooltipContent: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--primary))',
    color: 'hsl(var(--primary-foreground))',
    borderRadius: '0.375rem',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    outline: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  buttonBack: {
    color: 'hsl(var(--muted-foreground))',
    marginRight: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  buttonClose: {
    color: 'hsl(var(--muted-foreground))',
    height: '1rem',
    width: '1rem',
    cursor: 'pointer',
  },
  buttonSkip: {
    color: 'hsl(var(--muted-foreground))',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  spotlight: {
    borderRadius: '0.5rem',
  },
  beacon: {
    // Animated beacon for drawing attention
  },
  beaconInner: {
    backgroundColor: 'hsl(var(--primary))',
  },
  beaconOuter: {
    backgroundColor: 'hsl(var(--primary) / 0.2)',
    border: '2px solid hsl(var(--primary))',
  },
};

/**
 * Get locale strings for the tour
 */
export const tourLocale = {
  back: 'Back',
  close: 'Close',
  last: 'Connect GitHub',
  next: 'Next',
  open: 'Open the dialog',
  skip: 'Skip tour',
};

/**
 * Get floater props for consistent positioning
 */
export const floaterProps = {
  disableAnimation: false,
  hideArrow: false,
  offset: 15,
  styles: {
    arrow: {
      length: 8,
      spread: 12,
    },
  },
};
