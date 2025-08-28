import { useEffect, useRef, useCallback, RefObject } from 'react';

// Hook for keyboard navigation in virtual scrolling
export function useKeyboardNavigation<T extends HTMLElement>(
  itemCount: number,
  onSelect?: (index: number) => void,
  enabled = true
) {
  const selectedIndex = useRef(0);
  const containerRef = useRef<T>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          selectedIndex.current = Math.min(selectedIndex.current + 1, itemCount - 1);
          focusItem(selectedIndex.current);
          break;

        case 'ArrowUp':
          event.preventDefault();
          selectedIndex.current = Math.max(selectedIndex.current - 1, 0);
          focusItem(selectedIndex.current);
          break;

        case 'Home':
          event.preventDefault();
          selectedIndex.current = 0;
          focusItem(selectedIndex.current);
          break;

        case 'End':
          event.preventDefault();
          selectedIndex.current = itemCount - 1;
          focusItem(selectedIndex.current);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (onSelect) {
            onSelect(selectedIndex.current);
          }
          break;

        case 'Escape':
          event.preventDefault();
          // Remove focus from current item
          if (containerRef.current) {
            (containerRef.current as HTMLElement).focus();
          }
          break;
      }
    },
    [itemCount, onSelect, enabled]
  );

  const focusItem = (index: number) => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll('[role="row"], [role="option"]');
    const item = items[index] as HTMLElement;

    if (item) {
      item.focus();
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('keydown', handleKeyDown);

    // Set initial ARIA attributes
    container.setAttribute('role', 'grid');
    container.setAttribute('aria-label', 'Data table with keyboard navigation');
    container.setAttribute('tabindex', '0');

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  return {
    containerRef,
    selectedIndex: selectedIndex.current,
    focusItem,
  };
}

// Hook for screen reader announcements
export function useScreenReaderAnnounce() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a visually hidden live region for screen reader announcements
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
    announcerRef.current = announcer;

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
      // Clear after announcement to prepare for next one
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}

// Hook for managing focus trap (useful for modals and dropdowns)
export function useFocusTrap<T extends HTMLElement>(isActive = true): RefObject<T> {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Focus first element when trap is activated
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

// Hook for managing ARIA labels and descriptions
export function useAriaLabels(componentName: string, context?: Record<string, string | number>) {
  const generateLabel = useCallback(
    (element: string, action?: string) => {
      let label = `${componentName} ${element}`;

      if (action) {
        label += ` - ${action}`;
      }

      if (context) {
        const contextString = Object.entries(context)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        label += ` (${contextString})`;
      }

      return label;
    },
    [componentName, context]
  );

  const generateDescription = useCallback(
    (description: string) => {
      return `${componentName}: ${description}`;
    },
    [componentName]
  );

  return {
    label: generateLabel,
    description: generateDescription,
  };
}

// Hook for managing loading states with screen reader support
export function useAccessibleLoading(isLoading: boolean, loadingMessage = 'Loading...') {
  const announce = useScreenReaderAnnounce();

  useEffect(() => {
    if (isLoading) {
      announce(loadingMessage);
    } else {
      announce('Content loaded');
    }
  }, [isLoading, loadingMessage, announce]);

  return {
    'aria-busy': isLoading,
    'aria-label': isLoading ? loadingMessage : undefined,
  };
}
