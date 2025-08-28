import React, { memo, useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from '@/components/ui/icon';
import { debounce } from '../utils/analytics-utils';

interface ActivityTableFiltersProps {
  onSearchChange: (query: string) => void;
  onTypeFilterChange: (type: string) => void;
  typeFilter: string;
  searchQuery: string;
}

export const ActivityTableFilters = memo(
  ({
    onSearchChange,
    onTypeFilterChange,
    typeFilter,
    searchQuery: initialQuery,
  }: ActivityTableFiltersProps) => {
    const [localSearchQuery, setLocalSearchQuery] = useState(initialQuery);

    // Debounced search handler
    const debouncedSearch = useCallback(
      debounce((query: string) => {
        onSearchChange(query);
      }, 300),
      [onSearchChange]
    );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearchQuery(value);
      debouncedSearch(value);
    };

    // Sync local state with prop changes
    useEffect(() => {
      setLocalSearchQuery(initialQuery);
    }, [initialQuery]);

    return (
      <div className="flex flex-col sm:flex-row gap-4" role="search">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search activities..."
            value={localSearchQuery}
            onChange={handleSearchChange}
            className="pl-9"
            aria-label="Search activities"
            aria-describedby="search-description"
          />
          <span id="search-description" className="sr-only">
            Search by activity title, author, or repository name
          </span>
        </div>

        <Select
          value={typeFilter}
          onValueChange={onTypeFilterChange}
          aria-label="Filter by activity type"
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pr">Pull Requests</SelectItem>
            <SelectItem value="issue">Issues</SelectItem>
            <SelectItem value="commit">Commits</SelectItem>
            <SelectItem value="review">Reviews</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
);

ActivityTableFilters.displayName = 'ActivityTableFilters';
