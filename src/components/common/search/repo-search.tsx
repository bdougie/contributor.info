import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { useRepoSearch } from "@/hooks/use-repo-search";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface RepoSearchProps {
  isHomeView?: boolean;
  placeholder?: string;
  buttonText?: string;
}

export function RepoSearch({
  isHomeView = false,
  placeholder = "e.g., etcd-io/etcd or https://github.com/etcd-io/etcd",
  buttonText = "Analyze",
}: RepoSearchProps) {
  const {
    searchInput,
    setSearchInput,
    handleSearch,
    handleSelectExample,
    searchResults,
    isSearching,
  } = useRepoSearch({ isHomeView });

  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the popover when a repo is selected
  const handleSelectRepo = (repo: string) => {
    setSearchInput(repo);
    handleSelectExample(repo);
    setOpen(false);
  };

  // Show popover when there are search results
  useEffect(() => {
    if (searchResults.length > 0 && searchInput.length > 0) {
      setOpen(true);
    } else if (searchResults.length === 0 && searchInput.length === 0) {
      setOpen(false);
    }
  }, [searchResults, searchInput]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSearch(e);
        setOpen(false);
      }}
      className="flex gap-4"
    >
      <div className="relative flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={placeholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-full"
            align="start"
            sideOffset={5}
            style={{ width: inputRef.current?.offsetWidth }}
          >
            <Command>
              <CommandList>
                <CommandEmpty>
                  {isSearching ? "Searching..." : "No repositories found"}
                </CommandEmpty>
                <CommandGroup heading="Repositories">
                  {searchResults.map((repo) => (
                    <CommandItem
                      key={repo}
                      onSelect={() => handleSelectRepo(repo)}
                      className="cursor-pointer"
                    >
                      {repo}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <Button type="submit" aria-label={buttonText}>
        <SearchIcon className="mr-2 h-4 w-4" />
        {buttonText}
      </Button>
    </form>
  );
}