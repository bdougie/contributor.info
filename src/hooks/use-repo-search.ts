import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for handling repository search functionality
 */
export function useRepoSearch() {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

  /**
   * Handles form submission for repository search
   * Extracts owner and repo from URL or owner/repo format and navigates to repo page
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

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
    
    // Optionally auto-navigate when an example is selected
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
    handleSelectExample
  };
}