import { useState, useRef, useEffect } from 'react';
import { SearchIcon, Star, Clock, GitBranch, Loader2 } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGitHubSearch } from '@/hooks/use-github-search';
import { OrganizationAvatar } from '@/components/ui/organization-avatar';
import { useTimeFormatter } from '@/hooks/use-time-formatter';
import { Skeleton } from '@/components/ui/skeleton';
import type { GitHubRepository } from '@/lib/github';

interface GitHubSearchInputProps {
  placeholder?: string;
  value?: string;
  onSearch: (repository: string) => void;
  onSelect?: (repository: GitHubRepository) => void;
  className?: string;
  showButton?: boolean;
  buttonText?: string;
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
}: GitHubSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { formatRelativeTime } = useTimeFormatter();

  const { setQuery, results, loading } = useGitHubSearch({
    debounceMs: 300,
    minQueryLength: 2,
    maxResults: 8,
  });

  // Update search query when input changes
  useEffect(() => {
    setQuery(inputValue);
  }, [inputValue, setQuery]);

  // Show dropdown when we have results
  useEffect(() => {
    setShowDropdown(results.length > 0 && inputValue.length > 1);
    setSelectedIndex(-1);
  }, [results, inputValue]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
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
  const handleSelectRepository = (repository: GitHubRepository) => {
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
          handleSelectRepository(results[selectedIndex]);
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
            className="w-full pr-8"
            autoComplete="off"
          />
          {/* Loading spinner in input field */}
          {loading && inputValue.length > 1 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Dropdown with search results */}
          {showDropdown && (
            <div
              ref={dropdownRef}
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
                    type="button"
                    onClick={() => handleSelectRepository(repo)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-accent focus:bg-accent focus:outline-none transition-colors animate-in fade-in-0 slide-in-from-top-1 duration-300',
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
