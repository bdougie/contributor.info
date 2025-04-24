import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from './use-github-auth';

/**
 * Hook for handling repository search functionality
 */
export function useRepoSearch() {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const { isLoggedIn, setShowLoginDialog } = useGitHubAuth();

  /**
   * Handles form submission for repository search
   * Extracts owner and repo from URL or owner/repo format and navigates to repo page
   * If user is not logged in, shows login dialog instead of navigating
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // If user is not logged in, show login dialog and don't navigate
    if (!isLoggedIn) {
      setShowLoginDialog(true);
      return;
    }

    const match = searchInput.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

    if (match) {
      const [, newOwner, newRepo] = match;
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  /**
   * Handles selection of an example repository
   */
  const handleSelectExample = (repo: string) => {
    setSearchInput(repo);
    
    // Only auto-navigate if user is logged in
    if (isLoggedIn) {
      const match = repo.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
      if (match) {
        const [, newOwner, newRepo] = match;
        navigate(`/${newOwner}/${newRepo}`);
      }
    } else {
      // Show login dialog if trying to access repos while not logged in
      setShowLoginDialog(true);
    }
  };

  return { 
    searchInput, 
    setSearchInput, 
    handleSearch,
    handleSelectExample
  };
}