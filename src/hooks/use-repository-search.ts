import { useState, useEffect, useCallback } from 'react';
import { searchRepositories, type GitHubSearchRepository } from '@/lib/github';
import { useDebounce } from './use-debounce';

export interface UseRepositorySearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  maxResults?: number;
}

export interface UseRepositorySearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: GitHubSearchRepository[];
  isLoading: boolean;
  error: string | null;
  hasResults: boolean;
  clearResults: () => void;
}

/**
 * Hook for searching GitHub repositories with debouncing
 * @param options Configuration options
 * @returns Search state and functions
 */
export function useRepositorySearch(
  options: UseRepositorySearchOptions = {}
): UseRepositorySearchResult {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    maxResults = 10,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GitHubSearchRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < minQueryLength) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResponse = await searchRepositories(searchQuery, {
        sort: 'stars',
        order: 'desc',
        per_page: maxResults,
      });

      setResults(searchResponse.items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search repositories';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [minQueryLength, maxResults]);

  // Perform search when debounced query changes
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasResults: results.length > 0,
    clearResults,
  };
}