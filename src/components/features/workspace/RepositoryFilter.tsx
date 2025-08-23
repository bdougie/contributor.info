import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Check, 
  X, 
  Search,
  GitBranch
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface RepositoryOption {
  id: string;
  name: string;
  owner: string;
  full_name: string;
  stars_count?: number;
  language?: string;
}

export interface RepositoryFilterProps {
  repositories: RepositoryOption[];
  selectedRepositories: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RepositoryFilter({
  repositories,
  selectedRepositories,
  onSelectionChange,
  placeholder = "All Repositories",
  className,
  disabled = false,
}: RepositoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter repositories based on search term
  const filteredRepositories = repositories.filter(repo =>
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.language && repo.language.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleRepository = (repoId: string) => {
    const newSelection = selectedRepositories.includes(repoId)
      ? selectedRepositories.filter(id => id !== repoId)
      : [...selectedRepositories, repoId];
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange([]);
    setSearchTerm("");
  };

  const selectAll = () => {
    onSelectionChange(repositories.map(r => r.id));
  };

  const getButtonLabel = () => {
    if (selectedRepositories.length === 0) {
      return placeholder;
    }
    if (selectedRepositories.length === repositories.length) {
      return "All Repositories";
    }
    if (selectedRepositories.length === 1) {
      const repo = repositories.find(r => r.id === selectedRepositories[0]);
      return repo ? repo.full_name : placeholder;
    }
    return `${selectedRepositories.length} repositories`;
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant="outline"
        className={cn(
          "w-full justify-between",
          selectedRepositories.length > 0 && "bg-primary/5"
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="truncate">{getButtonLabel()}</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedRepositories.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedRepositories.length}
            </Badge>
          )}
          <ChevronDown 
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "transform rotate-180"
            )} 
          />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="flex-1 h-8 text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="flex-1 h-8 text-xs"
              disabled={selectedRepositories.length === 0}
            >
              Clear All
            </Button>
          </div>

          {/* Repository List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredRepositories.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No repositories found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredRepositories.map((repo) => {
                  const isSelected = selectedRepositories.includes(repo.id);
                  return (
                    <button
                      key={repo.id}
                      onClick={() => toggleRepository(repo.id)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 text-left">
                        <div className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center",
                          isSelected 
                            ? "bg-primary border-primary" 
                            : "border-input"
                        )}>
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {repo.full_name}
                          </div>
                          {repo.language && (
                            <div className="text-xs text-muted-foreground">
                              {repo.language}
                            </div>
                          )}
                        </div>
                      </div>
                      {repo.stars_count !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          ⭐ {repo.stars_count.toLocaleString()}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedRepositories.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{selectedRepositories.length} selected</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:text-foreground transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simplified version for single repository selection
export function SingleRepositoryFilter({
  repositories,
  selectedRepository,
  onSelectionChange,
  placeholder = "Select a repository",
  className,
  disabled = false,
}: {
  repositories: RepositoryOption[];
  selectedRepository: string | null;
  onSelectionChange: (selected: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredRepositories = repositories.filter(repo =>
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedRepo = repositories.find(r => r.id === selectedRepository);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="truncate">
            {selectedRepo ? selectedRepo.full_name : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {selectedRepository && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectionChange(null);
              }}
              className="hover:bg-accent rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown 
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "transform rotate-180"
            )} 
          />
        </div>
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredRepositories.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No repositories found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredRepositories.map((repo) => {
                  const isSelected = repo.id === selectedRepository;
                  return (
                    <button
                      key={repo.id}
                      onClick={() => {
                        onSelectionChange(repo.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="flex-1 text-left">
                        <div className="truncate font-medium">
                          {repo.full_name}
                        </div>
                        {repo.language && (
                          <div className="text-xs text-muted-foreground">
                            {repo.language}
                          </div>
                        )}
                      </div>
                      {repo.stars_count !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          ⭐ {repo.stars_count.toLocaleString()}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}