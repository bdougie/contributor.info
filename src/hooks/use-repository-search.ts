import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from './use-github-auth';
import { searchRepositories } from '@/lib/github';
import type { GitHubRepository } from '@/lib/types';

/**
 * Custom hook for searching GitHub repositories with fuzzy search
 * @param options.isHomeView - Whether the hook is being used on the home page
 * @param options.debounceMs - Debounce time in milliseconds
 */
export function useRepositorySearch({ 
  isHomeView = false,
  debounceMs = 300
}: { 
  isHomeView?: boolean;
  debounceMs?: number;
} = {}) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();

  /**
   * Debounced search function that fetches repositories based on search input
   */
  const debouncedSearch = useCallback(
    async (query: string) => {
      // Don't search if query is too short
      if (!query || query.length < 2) {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await searchRepositories(query);
        setSearchResults(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search repositories');
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Effect for debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      debouncedSearch(searchInput);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput, debouncedSearch, debounceMs]);

  /**
   * Handles navigation to a repository
   * On home page: Always allows navigation regardless of login status
   * On repo view: Requires login for all navigation
   */
  const handleSelectRepository = useCallback(
    (repository: GitHubRepository) => {
      const [owner, repo] = repository.full_name.split('/');
      
      // On the repo view, always require login
      if (!isHomeView && !isLoggedIn) {
        // Store intended destination to navigate after login
        localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
        navigate('/login');
        return;
      }
      
      // On home page or when logged in, continue with navigation
      navigate(`/${owner}/${repo}`);
    },
    [isHomeView, isLoggedIn, navigate]
  );

  /**
   * Handles form submission for repository search
   * Parses the input to extract owner/repo format
   */
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const match = searchInput.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

      if (match) {
        const [, newOwner, newRepo] = match;
        
        // On the repo view, always require login
        if (!isHomeView && !isLoggedIn) {
          // Store intended destination to navigate after login
          localStorage.setItem('redirectAfterLogin', `/${newOwner}/${newRepo}`);
          navigate('/login');
          return;
        }
        
        // On home page or when logged in, continue with search
        navigate(`/${newOwner}/${newRepo}`);
      }
    },
    [searchInput, isHomeView, isLoggedIn, navigate]
  );

  /**
   * Handles selection of an example repository
   */
  const handleSelectExample = useCallback(
    (repo: string) => {
      setSearchInput(repo);
      
      // Extract owner and repo name
      const match = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
      
      if (match) {
        const [, newOwner, newRepo] = match;
        
        // On the repo view, require login
        if (!isHomeView && !isLoggedIn) {
          // Store intended destination to navigate after login
          localStorage.setItem('redirectAfterLogin', `/${newOwner}/${newRepo}`);
          navigate('/login');
          return;
        }
        
        navigate(`/${newOwner}/${newRepo}`);
      }
    },
    [isHomeView, isLoggedIn, navigate]
  );

  return {
    searchInput,
    setSearchInput,
    searchResults,
    isLoading,
    error,
    handleSearch,
    handleSelectRepository,
    handleSelectExample
  };
}