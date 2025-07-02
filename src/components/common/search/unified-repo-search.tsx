import React, { useState, useRef, useEffect } from 'react';
import { useRepositorySearch } from '@/hooks/use-repository-search';
import { Button } from '@/components/ui/button';
import { SearchIcon, StarIcon, GitForkIcon, Clock } from 'lucide-react';
import { ExampleRepos } from '@/components/features/repository';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { formatDistanceToNow } from 'date-fns';

interface UnifiedRepoSearchProps {
  isHomeView?: boolean;
  placeholder?: string;
  buttonText?: string;
}

export function UnifiedRepoSearch({
  isHomeView = false,
  placeholder = 'Search GitHub repositories...',
  buttonText = 'Analyze',
}: UnifiedRepoSearchProps) {
  const {
    searchInput,
    setSearchInput,
    searchResults,
    isLoading,
    error,
    handleSearch,
    handleSelectRepository,
    handleSelectExample,
  } = useRepositorySearch({ isHomeView });

  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandRef.current &&
        !commandRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Open dropdown on arrow down
    if (e.key === 'ArrowDown' && !isOpen && searchInput.length > 0) {
      setIsOpen(true);
    }
    // Close dropdown on escape
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Format language with color
  const getLanguageColor = (language: string | null) => {
    const colors: Record<string, string> = {
      JavaScript: 'bg-yellow-300',
      TypeScript: 'bg-blue-400',
      Python: 'bg-green-500',
      Java: 'bg-orange-500',
      'C#': 'bg-purple-500',
      PHP: 'bg-indigo-400',
      Ruby: 'bg-red-500',
      Go: 'bg-cyan-400',
      Rust: 'bg-orange-600',
      Swift: 'bg-pink-500',
      Kotlin: 'bg-purple-400',
      Dart: 'bg-blue-300',
    };

    return language ? colors[language] || 'bg-gray-400' : 'bg-gray-300';
  };

  // Format numbers with K/M suffix
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="relative w-full" ref={commandRef}>
      <form
        onSubmit={(e) => {
          handleSearch(e);
          setIsOpen(false);
        }}
        className="flex gap-4"
      >
        <div className="relative flex-1">
          <Command className={`rounded-lg border shadow-md ${isOpen ? 'block' : 'hidden'} absolute top-full left-0 right-0 z-50 mt-2`}>
            <CommandInput
              ref={inputRef}
              value={searchInput}
              onValueChange={(value) => {
                setSearchInput(value);
                setIsOpen(value.length > 0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-9"
            />
            {isOpen && (
              <CommandList className="max-h-[300px] overflow-y-auto">
                {isLoading && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching repositories...
                  </div>
                )}
                {error && (
                  <div className="p-4 text-center text-sm text-destructive">
                    {error}
                  </div>
                )}
                <CommandEmpty>No repositories found</CommandEmpty>
                <CommandGroup heading="Repositories">
                  {searchResults.map((repo) => (
                    <CommandItem
                      key={repo.id}
                      onSelect={() => {
                        handleSelectRepository(repo);
                        setIsOpen(false);
                      }}
                      className="flex flex-col items-start py-3"
                    >
                      <div className="flex w-full items-center gap-2">
                        <img
                          src={repo.owner.avatar_url}
                          alt={repo.owner.login}
                          className="h-5 w-5 rounded-full"
                        />
                        <span className="font-medium">{repo.full_name}</span>
                        {repo.language && (
                          <span className={`ml-auto flex items-center rounded-full px-2 py-0.5 text-xs ${getLanguageColor(repo.language)} text-black`}>
                            {repo.language}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="mt-2 flex w-full items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <StarIcon className="h-3 w-3" />
                          <span>{formatNumber(repo.stargazers_count)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <GitForkIcon className="h-3 w-3" />
                          <span>{formatNumber(repo.forks_count)}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className="h-3 w-3" />
                          <span>Updated {formatDistanceToNow(new Date(repo.updated_at))} ago</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setIsOpen(e.target.value.length > 0);
            }}
            onFocus={() => {
              if (searchInput.length > 0) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button type="submit" aria-label={buttonText}>
          <SearchIcon className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </form>
      <ExampleRepos onSelect={handleSelectExample} />
    </div>
  );
}