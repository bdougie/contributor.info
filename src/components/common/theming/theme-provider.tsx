/* eslint-disable react-refresh/only-export-components */
// This file exports both ThemeProvider and useTheme which is the standard pattern

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * SSR-safe function to get stored theme
 * Returns defaultTheme on server, reads localStorage on client
 */
function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  // SSR guard - localStorage doesn't exist on server
  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && (stored === 'dark' || stored === 'light' || stored === 'system')) {
      return stored as Theme;
    }
  } catch {
    // localStorage may throw in some environments (e.g., private browsing)
  }

  return defaultTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  // Use SSR-safe initializer that returns defaultTheme on server
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme));

  // On client mount, sync with localStorage in case of hydration mismatch
  useEffect(() => {
    const stored = getStoredTheme(storageKey, defaultTheme);
    if (stored !== theme) {
      setTheme(stored);
    }
  }, [storageKey, defaultTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove existing theme classes to prevent conflicts
    root.classList.remove('light', 'dark');

    // Apply the selected theme
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // SSR guard for localStorage write
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newTheme);
        } catch {
          // localStorage may throw in some environments
        }
      }
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
