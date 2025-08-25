import { useEffect, useCallback } from 'react';

interface ShortcutHandler {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

/**
 * Hook for managing keyboard shortcuts throughout the application
 * @param shortcuts - Array of shortcut configurations
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  enabled = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs (unless explicitly allowed)
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isContentEditable = target.isContentEditable;
      
      // Allow Cmd+K even in inputs since it's a global command
      const isGlobalShortcut = event.metaKey && event.key === 'k';
      
      if ((isInput || isContentEditable) && !isGlobalShortcut) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        const isMetaMatch = shortcut.metaKey ? event.metaKey || event.ctrlKey : true;
        const isCtrlMatch = shortcut.ctrlKey ? event.ctrlKey : true;
        const isShiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const isAltMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const isKeyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (
          isKeyMatch &&
          isMetaMatch &&
          isCtrlMatch &&
          isShiftMatch &&
          isAltMatch
        ) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
        }
      });
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Global keyboard shortcuts used throughout the app
 */
export const GLOBAL_SHORTCUTS = {
  COMMAND_PALETTE: { key: 'k', metaKey: true },
  CREATE_WORKSPACE: { key: 'w', metaKey: true, shiftKey: true },
  SEARCH: { key: '/', metaKey: true },
  ESCAPE: { key: 'Escape' },
  QUICK_WORKSPACE_1: { key: '1', metaKey: true },
  QUICK_WORKSPACE_2: { key: '2', metaKey: true },
  QUICK_WORKSPACE_3: { key: '3', metaKey: true },
  QUICK_WORKSPACE_4: { key: '4', metaKey: true },
  QUICK_WORKSPACE_5: { key: '5', metaKey: true },
  QUICK_WORKSPACE_6: { key: '6', metaKey: true },
  QUICK_WORKSPACE_7: { key: '7', metaKey: true },
  QUICK_WORKSPACE_8: { key: '8', metaKey: true },
  QUICK_WORKSPACE_9: { key: '9', metaKey: true },
};

/**
 * Format a shortcut for display (e.g., "⌘K" or "Ctrl+K")
 */
export function formatShortcut(shortcut: Partial<ShortcutHandler>): string {
  const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  const parts: string[] = [];

  if (shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.ctrlKey && !shortcut.metaKey) {
    parts.push('Ctrl');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  
  if (shortcut.key) {
    parts.push(shortcut.key.toUpperCase());
  }

  return parts.join(isMac ? '' : '+');
}