import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from './use-github-auth';
import type { GitHubRepository } from '@/lib/github';

/**
 * Hook for handling repository search functionality
 * @param options.isHomeView - Whether the hook is being used on the home page. 
 * On home page, searches work regardless of login status. On repo view, searches require login.
 */
export function useRepoSearch({ isHomeView = false } = {}) {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();

  /**
   * Handles repository search/navigation
   * @param repository - Repository string in owner/repo format or GitHub URL
   */
  const handleRepositoryNavigation = (repository: string) => {
    const match = repository.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

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
   * Handles form submission for repository search (legacy compatibility)
   * On home page: Always allows search regardless of login status
   * On repo view: Requires login for all searches
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleRepositoryNavigation(searchInput);
  };

  /**
   * Handles selection of a repository from search results
   */
  const handleSelectRepository = (repository: GitHubRepository) => {
    setSearchInput(repository.full_name);
    handleRepositoryNavigation(repository.full_name);
  };

  /**
   * Handles selection of an example repository
   * On home page: Always navigates to the repository
   * On repo view: Requires login before navigation
   */
  const handleSelectExample = (repo: string) => {
    setSearchInput(repo);
    handleRepositoryNavigation(repo);
  };

  return { 
    searchInput, 
    setSearchInput, 
    handleSearch,
    handleSelectRepository,
    handleSelectExample,
    // Direct navigation handler for new search component
    handleRepositoryNavigation,
  };
}