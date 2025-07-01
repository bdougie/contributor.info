import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, GitBranch, Star, Clock, Loader2 } from 'lucide-react';
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
              if (query.length >= 2 && (hasResults || isLoading)) {
                setIsOpen(true);
              }
            }}
            onBlur={(e) => {
              // Don't close if clicking inside the dropdown
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (relatedTarget && relatedTarget.closest('[data-dropdown]')) {
                return;
              }
              setTimeout(() => setIsOpen(false), 200);
            }}
            className="flex-1 transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            autoComplete="off"
          />
          
          {/* Dropdown with absolute positioning and smooth animations */}
          {isOpen && (hasResults || isLoading || error || (query.length >= 2 && !isLoading && !hasResults)) && (
            <div 
              data-dropdown 
              className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border bg-background/95 backdrop-blur-sm p-0 text-foreground shadow-xl outline-none animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
            >
              <Command className="rounded-lg border-none shadow-none">
                <CommandList className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {isLoading && (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Searching repositories...</span>
                    </div>
                  )}
                  
                  {error && (
                    <div className="py-6 px-4 text-center text-sm text-destructive bg-destructive/5 rounded-md mx-2 mt-2">
                      <div className="font-medium mb-1">Search Error</div>
                      <div className="text-xs">{error}</div>
                    </div>
                  )}
                  
                  {!isLoading && !error && !hasResults && query.length >= 2 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      <div className="mb-2">🔍</div>
                      <div>No repositories found for "{query}"</div>
                      <div className="text-xs mt-1">Try a different search term</div>
                    </div>
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
                              "group flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 hover:bg-accent/50 border-b border-border/40 last:border-b-0",
                              isSelected && "bg-accent/80 shadow-sm"
                            )}
                          >
                            <div className="relative">
                              <img
                                src={repo.owner.avatar_url}
                                alt={repo.owner.login}
                                className="w-10 h-10 rounded-full ring-2 ring-background shadow-sm"
                                loading="lazy"
                              />
                              {repo.language && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary/10 border border-background flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                  {repo.full_name}
                                </span>
                                {repo.language && (
                                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium bg-muted/60">
                                    {repo.language}
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {repo.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors">
                                  <Star className="h-3.5 w-3.5" />
                                  <span className="font-medium">{starsText}</span>
                                </div>
                                <div className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
                                  <GitBranch className="h-3.5 w-3.5" />
                                  <span className="font-medium">{repo.forks_count}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{updatedText}</span>
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
        
        <Button type="submit" aria-label={buttonText} className="px-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
          <SearchIcon className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </form>
    </div>
  );
}