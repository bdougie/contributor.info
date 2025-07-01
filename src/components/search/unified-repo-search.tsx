import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, GitBranch, Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRepositorySearch } from '@/hooks/use-repository-search';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import type { GitHubSearchRepository } from '@/lib/github';

export interface UnifiedRepoSearchProps {
  /**
   * Whether this search is being used on the home page.
   * Home page: Always allows search regardless of login status
   * Repo view: Requires login for searches
   */
  isHomeView?: boolean;
  
  /**
   * Placeholder text for the search input
   */
  placeholder?: string;
  
  /**
   * Button text (e.g., "Analyze", "Search")
   */
  buttonText?: string;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Callback when a repository is selected (either from search or direct input)
   */
  onRepositorySelect?: (owner: string, repo: string) => void;
}

/**
 * Unified repository search component with fuzzy search dropdown
 * Replaces the separate home and repo-view search implementations
 */
export function UnifiedRepoSearch({
  isHomeView = false,
  placeholder = "Search repositories or enter owner/repo",
  buttonText = "Search",
  className,
  onRepositorySelect,
}: UnifiedRepoSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasResults,
    clearResults,
  } = useRepositorySearch({
    debounceMs: 300,
    minQueryLength: 2,
    maxResults: 8,
  });

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setQuery(value);
    setSelectedIndex(-1);
    
    // Show dropdown when typing if there might be results
    if (value.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Handle repository selection from dropdown
  const handleRepositorySelect = (repo: GitHubSearchRepository) => {
    const repoFullName = repo.full_name;
    setInputValue(repoFullName);
    setIsOpen(false);
    clearResults();
    
    if (onRepositorySelect) {
      const [owner, repoName] = repoFullName.split('/');
      onRepositorySelect(owner, repoName);
    } else {
      handleNavigation(repoFullName);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleRepositorySelect(results[selectedIndex]);
      return;
    }
    
    handleNavigation(inputValue);
  };

  // Handle navigation logic (same as original useRepoSearch)
  const handleNavigation = (input: string) => {
    const match = input.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    
    if (match) {
      const [, owner, repo] = match;
      
      // On the repo view, always require login
      if (!isHomeView && !isLoggedIn) {
        // Store intended destination to navigate after login
        localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
        navigate('/login');
        return;
      }
      
      // On home page or when logged in, continue with navigation
      navigate(`/${owner}/${repo}`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || !hasResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleRepositorySelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Format repository for display
  const formatRepository = (repo: GitHubSearchRepository) => {
    const starsCount = repo.stargazers_count;
    const starsText = starsCount >= 1000 
      ? `${(starsCount / 1000).toFixed(1)}k` 
      : starsCount.toString();
    
    const updatedDate = new Date(repo.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let updatedText = '';
    if (diffDays < 30) {
      updatedText = `${diffDays}d ago`;
    } else if (diffDays < 365) {
      updatedText = `${Math.floor(diffDays / 30)}mo ago`;
    } else {
      updatedText = `${Math.floor(diffDays / 365)}y ago`;
    }

    return { starsText, updatedText };
  };

  return (
    <div className={cn("relative w-full", className)}>
      <form onSubmit={handleSubmit} className="flex gap-4">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.length >= 2 && hasResults) {
                setIsOpen(true);
              }
            }}
            className="flex-1"
            autoComplete="off"
          />
          
          {/* Dropdown with absolute positioning */}
          {isOpen && (hasResults || isLoading || error || (query.length >= 2 && !isLoading && !hasResults)) && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none">
              <Command className="rounded-lg border-none shadow-none">
                <CommandList>
                  {isLoading && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Searching repositories...
                    </div>
                  )}
                  
                  {error && (
                    <div className="py-6 text-center text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  
                  {!isLoading && !error && !hasResults && query.length >= 2 && (
                    <CommandEmpty>No repositories found.</CommandEmpty>
                  )}
                  
                  {hasResults && (
                    <CommandGroup>
                      {results.map((repo, index) => {
                        const { starsText, updatedText } = formatRepository(repo);
                        const isSelected = index === selectedIndex;
                        
                        return (
                          <CommandItem
                            key={repo.id}
                            value={repo.full_name}
                            onSelect={() => handleRepositorySelect(repo)}
                            className={cn(
                              "flex items-center gap-3 p-3 cursor-pointer",
                              isSelected && "bg-accent"
                            )}
                          >
                            <img
                              src={repo.owner.avatar_url}
                              alt={repo.owner.login}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {repo.full_name}
                                </span>
                                {repo.language && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                    {repo.language}
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {repo.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  {starsText}
                                </div>
                                <div className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  {repo.forks_count}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {updatedText}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          )}
        </div>
        
        <Button type="submit" aria-label={buttonText}>
          <SearchIcon className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </form>
    </div>
  );
}