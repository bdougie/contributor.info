import { Filter, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilterAwareEmptyStateProps {
  hasActiveFilters: boolean;
  isSearchActive: boolean;
  searchTerm?: string;
  onClearFilters: () => void;
  onRefresh?: () => void;
  dataType: string; // e.g., "contributions", "repositories", "pull requests"
}

export function FilterAwareEmptyState({
  hasActiveFilters,
  isSearchActive,
  searchTerm,
  onClearFilters,
  onRefresh,
  dataType,
}: FilterAwareEmptyStateProps) {
  if (hasActiveFilters || isSearchActive) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="mb-4 p-4 rounded-full bg-muted">
          {isSearchActive ? (
            <Search className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Filter className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          No {dataType} match your current filters
        </h3>
        
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {isSearchActive && searchTerm
            ? `No results found for "${searchTerm}". Try adjusting your search or clearing filters.`
            : `Your active filters are hiding all available ${dataType}. Try adjusting or clearing them to see results.`}
        </p>
        
        <div className="flex gap-3">
          <Button onClick={onClearFilters} variant="default">
            Clear all filters
          </Button>
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh data
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Regular empty state when no filters are active
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 p-4 rounded-full bg-muted">
        <RefreshCw className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">
        No {dataType} found yet
      </h3>
      
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Data for this repository is being loaded in the background. 
        This usually takes a few moments for active repositories.
      </p>
      
      {onRefresh && (
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Check for updates
        </Button>
      )}
    </div>
  );
}