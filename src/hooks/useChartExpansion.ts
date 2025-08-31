import { useState, useCallback, useEffect } from 'react';

interface UseChartExpansionOptions {
  defaultExpanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  persistKey?: string;
}

interface UseChartExpansionReturn {
  isExpanded: boolean;
  toggleExpansion: () => void;
  setExpanded: (expanded: boolean) => void;
  containerProps: {
    className: string;
    style: React.CSSProperties;
  };
  buttonProps: {
    onClick: () => void;
    'aria-label': string;
    'aria-expanded': boolean;
  };
}

/**
 * Custom hook for managing chart expansion state
 * Provides consistent expansion behavior across all chart components
 */
export function useChartExpansion(options: UseChartExpansionOptions = {}): UseChartExpansionReturn {
  const { defaultExpanded = false, onExpand, onCollapse, persistKey } = options;

  // Initialize state from localStorage if persistKey is provided
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (persistKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`chart-expanded-${persistKey}`);
      return stored ? stored === 'true' : defaultExpanded;
    }
    return defaultExpanded;
  });

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(`chart-expanded-${persistKey}`, String(isExpanded));
    }
  }, [isExpanded, persistKey]);

  const toggleExpansion = useCallback(() => {
    setIsExpanded((prev) => {
      const newState = !prev;
      if (newState) {
        onExpand?.();
      } else {
        onCollapse?.();
      }
      return newState;
    });
  }, [onExpand, onCollapse]);

  const setExpanded = useCallback(
    (expanded: boolean) => {
      setIsExpanded(expanded);
      if (expanded) {
        onExpand?.();
      } else {
        onCollapse?.();
      }
    },
    [onExpand, onCollapse]
  );

  // Container props for the chart wrapper
  const containerProps = {
    className: isExpanded ? 'fixed inset-4 z-50 bg-background' : '',
    style: isExpanded
      ? {
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 2rem)',
        }
      : {},
  };

  // Button props for the expansion toggle
  const buttonProps = {
    onClick: toggleExpansion,
    'aria-label': isExpanded ? 'Collapse chart' : 'Expand chart',
    'aria-expanded': isExpanded,
  };

  return {
    isExpanded,
    toggleExpansion,
    setExpanded,
    containerProps,
    buttonProps,
  };
}

/**
 * Hook for managing multiple chart expansions
 * Ensures only one chart is expanded at a time
 */
export function useChartExpansionGroup() {
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const createChartExpansion = useCallback(
    (chartId: string) => {
      const isExpanded = expandedChart === chartId;

      const toggleExpansion = () => {
        setExpandedChart((prev) => (prev === chartId ? null : chartId));
      };

      const setExpanded = (expanded: boolean) => {
        setExpandedChart(expanded ? chartId : null);
      };

      return {
        isExpanded,
        toggleExpansion,
        setExpanded,
        containerProps: {
          className: isExpanded ? 'fixed inset-4 z-50 bg-background' : '',
          style: isExpanded
            ? {
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'calc(100vh - 2rem)',
              }
            : {},
        },
        buttonProps: {
          onClick: toggleExpansion,
          'aria-label': isExpanded ? 'Collapse chart' : 'Expand chart',
          'aria-expanded': isExpanded,
        },
      };
    },
    [expandedChart]
  );

  return {
    expandedChart,
    createChartExpansion,
    collapseAll: () => setExpandedChart(null),
  };
}
