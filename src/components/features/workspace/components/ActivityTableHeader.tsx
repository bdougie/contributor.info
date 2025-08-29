import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from '@/components/ui/icon';

export type SortField = 'created_at' | 'type' | 'author' | 'repository';
export type SortOrder = 'asc' | 'desc';

interface ActivityTableHeaderProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

const SortIcon = memo(
  ({
    field,
    currentField,
    currentOrder,
  }: {
    field: SortField;
    currentField: SortField;
    currentOrder: SortOrder;
  }) => {
    if (currentField !== field) return null;
    return currentOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" aria-label="Sorted ascending" />
    ) : (
      <ChevronDown className="h-4 w-4" aria-label="Sorted descending" />
    );
  }
);

SortIcon.displayName = 'SortIcon';

export const ActivityTableHeader = memo(
  ({ sortField, sortOrder, onSort }: ActivityTableHeaderProps) => {
    return (
      <div className="border-b bg-muted/50" role="row">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-4 w-full">
            <div className="flex-shrink-0 w-24" role="columnheader">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-8 data-[state=open]:bg-accent"
                onClick={() => onSort('type')}
                aria-label={`Sort by type, currently ${sortField === 'type' ? `sorted ${sortOrder}` : 'not sorted'}`}
                aria-sort={
                  sortField === 'type' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : ('none' as const)
                }
              >
                Type
                <SortIcon field="type" currentField={sortField} currentOrder={sortOrder} />
              </Button>
            </div>
            <div className="flex-1 min-w-0" role="columnheader">
              Activity
            </div>
            <div className="flex-shrink-0 w-32" role="columnheader">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-8 data-[state=open]:bg-accent"
                onClick={() => onSort('author')}
                aria-label={`Sort by author, currently ${sortField === 'author' ? `sorted ${sortOrder}` : 'not sorted'}`}
                aria-sort={
                  sortField === 'author'
                    ? (sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending')
                    : ('none' as const)
                }
              >
                Author
                <SortIcon field="author" currentField={sortField} currentOrder={sortOrder} />
              </Button>
            </div>
            <div className="flex-shrink-0 min-w-[10rem]" role="columnheader">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-8 data-[state=open]:bg-accent"
                onClick={() => onSort('repository')}
                aria-label={`Sort by repository, currently ${sortField === 'repository' ? `sorted ${sortOrder}` : 'not sorted'}`}
                aria-sort={
                  sortField === 'repository'
                    ? (sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending')
                    : ('none' as const)
                }
              >
                Repository
                <SortIcon field="repository" currentField={sortField} currentOrder={sortOrder} />
              </Button>
            </div>
            <div className="flex-shrink-0 w-24" role="columnheader">
              Status
            </div>
            <div className="flex-shrink-0 w-32" role="columnheader">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-8 data-[state=open]:bg-accent"
                onClick={() => onSort('created_at')}
                aria-label={`Sort by date, currently ${sortField === 'created_at' ? `sorted ${sortOrder}` : 'not sorted'}`}
                aria-sort={
                  sortField === 'created_at'
                    ? (sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending')
                    : ('none' as const)
                }
              >
                Date
                <SortIcon field="created_at" currentField={sortField} currentOrder={sortOrder} />
              </Button>
            </div>
            <div className="w-12" role="columnheader" aria-label="Actions"></div>
          </div>
        </div>
      </div>
    );
  }
);

ActivityTableHeader.displayName = 'ActivityTableHeader';
