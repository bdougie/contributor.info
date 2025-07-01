import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from './use-github-auth';
import { useDebouncedValue } from './use-debounced-value';

// Popular repositories to suggest when searching
const POPULAR_REPOS = [
  'facebook/react',
  'vuejs/vue',
  'angular/angular',
  'microsoft/vscode',
  'tensorflow/tensorflow',
  'kubernetes/kubernetes',
  'denoland/deno',
  'golang/go',
  'rust-lang/rust',
  'nodejs/node',
  'vercel/next.js',
  'sveltejs/svelte',
  'laravel/laravel',
  'django/django',
  'rails/rails',
  'flutter/flutter',
  'ethereum/go-ethereum',
  'bitcoin/bitcoin',
  'torvalds/linux',
  'apple/swift',
];

interface GitHubSearchResult {
  items: Array<{
    full_name: string;
  }>;
}

/**
 * Hook for handling repository search functionality with fuzzy search
 * @param options.isHomeView - Whether the hook is being used on the home page. 
 * On home page, searches work regardless of login status. On repo view, searches require login.
 */
export function useRepoSearch({ isHomeView = false } = {}) {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();
  
  // Debounce the search input to avoid making too many API calls
  const debouncedSearchTerm = useDebouncedValue(searchInput, 300);

  /**
   * Performs a fuzzy search for repositories based on the input
   */
  const performFuzzySearch = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // First try to match from popular repos for instant results
      const filteredPopular = POPULAR_REPOS.filter(repo => 
        repo.toLowerCase().includes(term.toLowerCase())
      ).slice(0, 5);
      
      // If we have enough results from popular repos, use those
      if (filteredPopular.length >= 3) {
        setSearchResults(filteredPopular);
        setIsSearching(false);
        return;
      }

      // Otherwise, search GitHub API
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(term)}&sort=stars&order=desc&per_page=5`
      );

      if (!response.ok) {
        throw new Error('GitHub API request failed');
      }

      const data: GitHubSearchResult = await response.json();
      
      // Combine results from popular repos and GitHub API
      const apiResults = data.items.map(item => item.full_name);
      const combinedResults = [...new Set([...filteredPopular, ...apiResults])].slice(0, 5);
      
      setSearchResults(combinedResults);
    } catch (error) {
      console.error('Error searching repositories:', error);
      // Fallback to just popular repos if API fails
      const filteredPopular = POPULAR_REPOS.filter(repo => 
        repo.toLowerCase().includes(term.toLowerCase())
      ).slice(0, 5);
      setSearchResults(filteredPopular);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Trigger search when debounced term changes
  useEffect(() => {
    performFuzzySearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, performFuzzySearch]);

  /**
   * Handles form submission for repository search
   * On home page: Always allows search regardless of login status
   * On repo view: Requires login for all searches
   */
  const handleSearch = (e: React.FormEvent) => {
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
  };

  /**
   * Handles selection of an example repository
   * On home page: Always navigates to the repository
   * On repo view: Requires login before navigation
   */
  const handleSelectExample = (repo: string) => {
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
  };

  return { 
    searchInput, 
    setSearchInput, 
    handleSearch,
    handleSelectExample,
    searchResults,
    isSearching
  };
}