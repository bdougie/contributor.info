import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Filter } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ContributorGroup } from './ContributorsTable';

export interface ContributorGroupFilterProps {
  groups: ContributorGroup[];
  selectedGroups: string[];
  onGroupsChange: (groupIds: string[]) => void;
  onCreateGroup?: () => void;
  contributorCounts?: Map<string, number>; // groupId -> count
  className?: string;
  variant?: 'dropdown' | 'badges';
}

export function ContributorGroupFilter({
  groups,
  selectedGroups,
  onGroupsChange,
  onCreateGroup,
  contributorCounts = new Map(),
  className,
  variant = 'badges',
}: ContributorGroupFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleGroup = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onGroupsChange(selectedGroups.filter((id) => id !== groupId));
    } else {
      onGroupsChange([...selectedGroups, groupId]);
    }
  };

  const clearFilters = () => {
    onGroupsChange([]);
  };

  const selectAll = () => {
    onGroupsChange(groups.map((g) => g.id));
  };

  if (variant === 'dropdown') {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn('justify-between', className)}>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>
                {(() => {
                  if (selectedGroups.length === 0) {
                    return 'All Groups';
                  }
                  if (selectedGroups.length === 1) {
                    return groups.find((g) => g.id === selectedGroups[0])?.name;
                  }
                  return `${selectedGroups.length} groups`;
                })()}
              </span>
            </div>
            {selectedGroups.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedGroups.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Filter by Groups</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-[300px]">
            {groups.map((group) => {
              const count = contributorCounts.get(group.id) || 0;
              return (
                <DropdownMenuCheckboxItem
                  key={group.id}
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{group.name}</span>
                    {count > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {count}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })}
          </ScrollArea>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={selectAll}>Select All</DropdownMenuItem>
          <DropdownMenuItem onClick={clearFilters}>Clear Filters</DropdownMenuItem>
          {onCreateGroup && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCreateGroup}>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Badge variant
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm font-medium text-muted-foreground">Groups:</span>

      {/* All Groups badge */}
      <Badge
        variant={selectedGroups.length === 0 ? 'default' : 'outline'}
        className="cursor-pointer"
        onClick={() => clearFilters()}
      >
        All Groups
      </Badge>

      {/* Group badges */}
      {groups.map((group) => {
        const isSelected = selectedGroups.includes(group.id);
        const count = contributorCounts.get(group.id) || 0;

        return (
          <Badge
            key={group.id}
            variant={isSelected ? group.color : 'outline'}
            className={cn(
              'cursor-pointer transition-all',
              !isSelected && 'opacity-60 hover:opacity-100'
            )}
            onClick={() => toggleGroup(group.id)}
          >
            <span>{group.name}</span>
            {count > 0 && <span className="ml-1.5 text-xs opacity-75">({count})</span>}
          </Badge>
        );
      })}

      {/* Create group button */}
      {onCreateGroup && (
        <Button variant="ghost" size="sm" onClick={onCreateGroup} className="h-6 px-2">
          <Plus className="h-3 w-3 mr-1" />
          Create Group
        </Button>
      )}
    </div>
  );
}
