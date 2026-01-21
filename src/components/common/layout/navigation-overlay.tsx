import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface NavigationOverlayProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Modern full-screen navigation overlay with accessibility support
 *
 * Features:
 * - Animated hamburger → X transition
 * - Full-screen backdrop blur overlay
 * - Focus trap (Tab cycles within menu)
 * - Escape key closes menu
 * - Focus management (return focus on close)
 * - WAI-ARIA compliant
 */
export function NavigationOverlay({ isOpen, onOpenChange, children }: NavigationOverlayProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the element that had focus before opening
  const open = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    onOpenChange(true);
  }, [onOpenChange]);

  const close = useCallback(
    (returnFocus = true) => {
      onOpenChange(false);
      if (returnFocus && previousActiveElement.current) {
        // Return focus to the trigger button after animation
        setTimeout(() => {
          previousActiveElement.current?.focus();
        }, 100);
      }
    },
    [onOpenChange]
  );

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Focus first focusable element when menu opens
  useEffect(() => {
    if (isOpen && menuContentRef.current) {
      const focusableElements = menuContentRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        // Small delay to allow animation to start
        setTimeout(() => {
          focusableElements[0]?.focus();
        }, 100);
      }
    }
  }, [isOpen]);

  // Keyboard handlers: Escape and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes menu
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      // Focus trap for Tab key
      if (e.key === 'Tab' && menuContentRef.current) {
        const focusableElements = menuContentRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: wrap from first to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: wrap from last to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Hamburger trigger button - z-60 to stay above overlay (z-50) */}
      {/* When open, transitions to fixed position aligned with menu content (left-6 = 24px to match p-6 padding) */}
      <button
        ref={triggerRef}
        className={cn(
          'p-2 rounded-md transition-all duration-300 ease-in-out',
          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          isOpen
            ? 'fixed top-5 left-[22px] z-[60] bg-transparent hover:bg-muted/20'
            : 'relative z-[60]'
        )}
        onClick={toggle}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls="nav-menu-content"
        aria-haspopup="dialog"
        data-tour="navigation-menu"
      >
        <div className="relative w-5 h-5 flex items-center justify-center" aria-hidden="true">
          <span
            className={cn(
              'absolute block w-4 h-0.5 bg-current transition-all duration-300 ease-in-out',
              isOpen ? 'rotate-45 top-[9px]' : 'top-[5px]'
            )}
          />
          <span
            className={cn(
              'absolute block w-4 h-0.5 bg-current transition-all duration-300 ease-in-out',
              isOpen ? '-rotate-45 top-[9px]' : 'top-[13px]'
            )}
          />
        </div>
      </button>

      {/* Full-screen overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-all duration-300 ease-in-out',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Backdrop with blur */}
        <div
          className={cn(
            'absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-300',
            'dark:bg-background/90'
          )}
          onClick={() => close()}
          aria-hidden="true"
        />

        {/* Menu content */}
        <div
          id="nav-menu-content"
          ref={menuContentRef}
          className={cn(
            'absolute top-14 left-0 w-full max-w-sm h-[calc(100vh-3.5rem)] p-6 pt-4 overflow-y-auto',
            'transition-all duration-300 ease-in-out',
            isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          )}
          aria-hidden={!isOpen}
        >
          {children}
        </div>
      </div>
    </>
  );
}

interface NavSectionProps {
  title: string;
  titleId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Navigation section with proper ARIA grouping
 */
export function NavSection({ title, titleId, children, className }: NavSectionProps) {
  return (
    <div className={cn('mb-6', className)} role="group" aria-labelledby={titleId}>
      <h2
        id={titleId}
        className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3"
      >
        {title}
      </h2>
      <ul className="space-y-1 list-none p-0 m-0">{children}</ul>
    </div>
  );
}

interface NavLinkProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * Navigation link with consistent styling and focus indicators
 */
export function NavLink({ children, onClick, href, external, className, icon }: NavLinkProps) {
  const baseClasses = cn(
    'flex items-center gap-2 px-3 py-2 -mx-3 rounded-md text-base font-medium',
    'text-foreground hover:text-primary hover:bg-muted/50',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    className
  );

  if (href && external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClasses}
          onClick={onClick}
        >
          {icon}
          {children}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      </li>
    );
  }

  if (href) {
    // For internal links, we'll use onClick to navigate via React Router
    return (
      <li>
        <button className={cn(baseClasses, 'w-full text-left')} onClick={onClick}>
          {icon}
          {children}
        </button>
      </li>
    );
  }

  return (
    <li>
      <button className={cn(baseClasses, 'w-full text-left')} onClick={onClick}>
        {icon}
        {children}
      </button>
    </li>
  );
}
