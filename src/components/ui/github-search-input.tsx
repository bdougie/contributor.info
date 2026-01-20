import { useState, useRef, useEffect, useCallback } from 'react';
import { SearchIcon, Star, Clock, GitBranch, Loader2 } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { useGitHubSearch } from '@/hooks/use-github-search';
import { OrganizationAvatar } from '@/components/ui/organization-avatar';
import { useTimeFormatter } from '@/hooks/use-time-formatter';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/use-analytics';
import type { GitHubRepository } from '@/lib/github';

// Debounce utility for search query tracking
function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

interface GitHubSearchInputProps {
  placeholder?: string;
  value?: string;
  onSearch: (repository: string) => void;
  onSelect?: (repository: GitHubRepository) => void;
  className?: string;
  showButton?: boolean;
  buttonText?: string;
  searchLocation?: 'header' | 'homepage' | 'trending';
  shortcut?: boolean;
}

// Language color mapping (subset of common languages)
const languageColors: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#FA7343',
  Kotlin: '#A97BFF',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
};

export function GitHubSearchInput({
  placeholder = 'Search repositories (e.g., facebook/react)',
  value = '',
  onSearch,
  onSelect,
  className,
  showButton = true,
  buttonText = 'Search',
  searchLocation = 'homepage',
  shortcut = false,
}: GitHubSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { formatRelativeTime } = useTimeFormatter();
  const {
    trackSearchResultsViewed,
    trackRepositorySelectedFromSearch,
    trackRepoSearchInitiated,
    trackRepoSearchQueryEntered,
    trackRepoSearchResultClicked,
    trackRepoSearchCompleted,
  } = useAnalytics();
  const hasTrackedFocusRef = useRef(false);

  const { setQuery, results, loading } = useGitHubSearch({
    debounceMs: 300,
    minQueryLength: 2,
    maxResults: 8,
  });

  // Update search query when input changes
  useEffect(() => {
    setQuery(inputValue);
  }, [inputValue, setQuery]);

  // Handle global keyboard shortcut
  useEffect(() => {
    if (!shortcut) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Focus on "/"
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((document.activeElement as Element)?.tagName || '')
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [shortcut]);

  // PLG Tracking: Debounced query tracking
  const trackQueryDebounced = useDebouncedCallback((query: string, hasResults: boolean) => {
    if (query.length >= 2) {
      trackRepoSearchQueryEntered(searchLocation, query.length, hasResults);
    }
  }, 500);

  // Track query entered when results change
  useEffect(() => {
    if (inputValue.length >= 2) {
      trackQueryDebounced(inputValue, results.length > 0);
    }
  }, [inputValue, results.length, trackQueryDebounced]);

  // Show dropdown when we have results
  useEffect(() => {
    const shouldShowDropdown = results.length > 0 && inputValue.length > 1;
    setShowDropdown(shouldShowDropdown);
    setSelectedIndex(-1);

    // Track search results viewed
    if (shouldShowDropdown && results.length > 0) {
      trackSearchResultsViewed(results.length, searchLocation);
    }
  }, [results, inputValue, searchLocation, trackSearchResultsViewed]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // PLG Tracking: Handle input focus to track search initiation
  const handleInputFocus = () => {
    // Only track focus once per component mount to avoid noise
    if (!hasTrackedFocusRef.current) {
      hasTrackedFocusRef.current = true;
      trackRepoSearchInitiated(searchLocation);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIndex >= 0 && results[selectedIndex]) {
      const selected = results[selectedIndex];
      handleSelectRepository(selected);
    } else {
      onSearch(inputValue);
      setInputValue(''); // Clear the input after search
      setShowDropdown(false);
    }
  };

  // Handle repository selection
  const handleSelectRepository = (repository: GitHubRepository, resultIndex?: number) => {
    // Existing tracking
    trackRepositorySelectedFromSearch(searchLocation, resultIndex);

    // PLG Tracking: Track result click and completion
    if (resultIndex !== undefined) {
      trackRepoSearchResultClicked(searchLocation, resultIndex, 'api_result');
    }
    // Track search completion which also handles activation milestone
    trackRepoSearchCompleted(searchLocation, repository.full_name);

    setInputValue(''); // Clear the input when selecting a repository
    setShowDropdown(false);
    setSelectedIndex(-1);

    if (onSelect) {
      onSelect(repository);
    } else {
      onSearch(repository.full_name);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelectRepository(results[selectedIndex], selectedIndex);
        } else {
          handleSubmit(e);
        }
        break;

      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit} className="flex gap-4">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            className="w-full pr-8 peer"
            autoComplete="off"
            role="combobox"
            aria-keyshortcuts={shortcut ? '/' : undefined}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'github-search-listbox' : undefined}
            aria-activedescendant={
              selectedIndex >= 0 && results[selectedIndex]
                ? `search-result-${results[selectedIndex].id}`
                : undefined
            }
            aria-label="Search GitHub repositories"
          />
          {/* Loading spinner in input field */}
          {loading && inputValue.length > 1 ? (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* Keyboard shortcut hint */
            shortcut &&
            !inputValue && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:block pointer-events-none peer-focus:hidden">
                <Kbd>/</Kbd>
              </div>
            )
          )}

          {/* Dropdown with search results */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              id="github-search-listbox"
              role="listbox"
              aria-label="Search results"
              className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-80 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200"
            >
              {loading && (
                <div className="p-2">
                  {/* Skeleton loaders for search results */}
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={index}
                      className="p-2 animate-in fade-in-0 duration-500"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-full" />
                          <div className="flex items-center space-x-4">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading &&
                results.map((repo, index) => (
                  <button
                    key={repo.id}
                    id={`search-result-${repo.id}`}
                    type="button"
                    role="option"
                    aria-selected={selectedIndex === index}
                    onClick={() => handleSelectRepository(repo, index)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-accent focus:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors animate-in fade-in-0 slide-in-from-top-1 duration-300',
                      selectedIndex === index && 'bg-accent'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center space-x-3">
                      <OrganizationAvatar
                        src={repo.owner.avatar_url}
                        alt={repo.owner.login}
                        size={32}
                        priority={index < 3}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{repo.full_name}</span>
                          {repo.language && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: languageColors[repo.language] || '#959da5',
                                }}
                              />
                              <span>{repo.language}</span>
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {repo.description}
                          </div>
                        )}
                        <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Star className="w-3 h-3" />
                            <span>{repo.stargazers_count.toLocaleString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <GitBranch className="w-3 h-3" />
                            <span>{repo.forks_count.toLocaleString()}</span>
                          </span>
                          {repo.pushed_at && (
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatRelativeTime(repo.pushed_at)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

              {!loading && results.length === 0 && inputValue.length > 1 && (
                <div className="px-4 py-3 text-sm text-muted-foreground animate-in fade-in-0 duration-300">
                  No repositories found
                </div>
              )}
            </div>
          )}
        </div>

        {showButton && (
          <Button type="submit" aria-label={buttonText}>
            <SearchIcon className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        )}
      </form>
    </div>
  );
}
