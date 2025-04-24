import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from './use-github-auth';

/**
 * Hook for handling repository search functionality
 * Allows one repository search without login, but requires login for subsequent searches
 */
export function useRepoSearch() {
  const [searchInput, setSearchInput] = useState('');
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  const navigate = useNavigate();
  const { isLoggedIn, showLoginDialog, setShowLoginDialog } = useGitHubAuth();

  // Check localStorage for search history on mount
  useEffect(() => {
    const hasSearchedBefore = localStorage.getItem('hasSearchedBefore') === 'true';
    setHasSearchedOnce(hasSearchedBefore);
  }, []);

  /**
   * Handles form submission for repository search
   * Allows first search without login, but requires login for subsequent searches
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const match = searchInput.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

    if (match) {
      const [, newOwner, newRepo] = match;
      
      // If user has already searched once and is not logged in, show login dialog
      if (hasSearchedOnce && !isLoggedIn) {
        // Store intended destination to navigate after login
        localStorage.setItem('redirectAfterLogin', `/${newOwner}/${newRepo}`);
        setShowLoginDialog(true);
        return;
      }
      
      // Mark that user has searched at least once
      if (!hasSearchedOnce) {
        setHasSearchedOnce(true);
        localStorage.setItem('hasSearchedBefore', 'true');
      }
      
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  /**
   * Handles selection of an example repository
   * Updates the search input and navigates to the repository
   */
  const handleSelectExample = (repo: string) => {
    setSearchInput(repo);
    
    // Extract owner and repo name
    const match = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    
    if (match) {
      const [, newOwner, newRepo] = match;
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  return { 
    searchInput, 
    setSearchInput, 
    handleSearch,
    handleSelectExample,
    hasSearchedOnce
  };
}