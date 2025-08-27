import { useState, useEffect, useCallback } from 'react';
import { searchGitHubRepositories, type GitHubRepository } from '@/lib/github';

interface UseGitHubSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
}

interface UseGitHubSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: GitHubRepository[];
  loading: boolean;
  error: string | null;
  clearResults: () => void;
}

/**
 * Hook for searching GitHub repositories with fuzzy search functionality
 * @param options - Configuration options for the search
 * @returns Search state and functions
 */
export function useGitHubSearch({
  debounceMs = 300,
  minQueryLength = 2,
  maxResults = 10,
}: UseGitHubSearchOptions = {}): UseGitHubSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const repositories = await searchGitHubRepositories(searchQuery, maxResults);
        setResults(repositories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search repositories');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [minQueryLength, maxResults]
  );

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch(query.trim());
      } else {
        setResults([]);
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, debounceMs, performSearch]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearResults,
  };
}
