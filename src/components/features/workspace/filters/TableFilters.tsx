import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  type PRState,
  type IssueState,
  type IssueAssignmentFilter,
} from '@/lib/workspace-filters-store';

interface PRFiltersProps {
  selectedStates: PRState[];
  includeBots: boolean;
  onToggleState: (state: PRState) => void;
  onIncludeBotsChange: (include: boolean) => void;
  onReset?: () => void;
  hasBots?: boolean;
}

interface IssueFiltersProps {
  selectedStates: IssueState[];
  includeBots: boolean;
  assignmentFilter: IssueAssignmentFilter;
  onToggleState: (state: IssueState) => void;
  onIncludeBotsChange: (include: boolean) => void;
  onAssignmentFilterChange: (filter: IssueAssignmentFilter) => void;
  onReset?: () => void;
  hasBots?: boolean;
}

export function PRFilters({
  selectedStates,
  includeBots,
  onToggleState,
  onIncludeBotsChange,
  onReset,
  hasBots = false,
}: PRFiltersProps) {
  const prStateLabels: Record<PRState, string> = {
    open: 'Open',
    closed: 'Closed',
    merged: 'Merged',
    draft: 'Draft',
  };

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {(Object.keys(prStateLabels) as PRState[]).map((state) => (
        <div key={state} className="flex items-center space-x-2">
          <Switch
            id={`filter-pr-${state}`}
            checked={selectedStates.includes(state)}
            onCheckedChange={() => onToggleState(state)}
            aria-label={`Filter pull requests by ${prStateLabels[state]} state`}
          />
          <Label htmlFor={`filter-pr-${state}`} className="text-sm">
            {prStateLabels[state]}
          </Label>
        </div>
      ))}

      {hasBots && (
        <div className="flex items-center space-x-2">
          <Switch
            id="filter-pr-bots"
            checked={includeBots}
            onCheckedChange={onIncludeBotsChange}
            aria-label="Show or hide pull requests from bots"
          />
          <Label htmlFor="filter-pr-bots" className="text-sm">
            Show Bots
          </Label>
        </div>
      )}

      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="ml-auto"
          aria-label="Reset all pull request filters to default"
        >
          Reset Filters
        </Button>
      )}
    </div>
  );
}

export function IssueFilters({
  selectedStates,
  includeBots,
  assignmentFilter,
  onToggleState,
  onIncludeBotsChange,
  onAssignmentFilterChange,
  onReset,
  hasBots = false,
}: IssueFiltersProps) {
  const issueStateLabels: Record<IssueState, string> = {
    open: 'Open',
    closed: 'Closed',
  };

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {(Object.keys(issueStateLabels) as IssueState[]).map((state) => (
        <div key={state} className="flex items-center space-x-2">
          <Switch
            id={`filter-issue-${state}`}
            checked={selectedStates.includes(state)}
            onCheckedChange={() => onToggleState(state)}
            aria-label={`Filter issues by ${issueStateLabels[state]} state`}
          />
          <Label htmlFor={`filter-issue-${state}`} className="text-sm">
            {issueStateLabels[state]}
          </Label>
        </div>
      ))}

      <div className="flex items-center space-x-2">
        <Switch
          id="filter-issue-assigned"
          checked={assignmentFilter === 'assigned'}
          onCheckedChange={(checked) => {
            if (checked) {
              onAssignmentFilterChange('assigned');
            } else {
              onAssignmentFilterChange('all');
            }
          }}
          aria-label="Show only assigned issues"
        />
        <Label htmlFor="filter-issue-assigned" className="text-sm">
          Assigned
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="filter-issue-unassigned"
          checked={assignmentFilter === 'unassigned'}
          onCheckedChange={(checked) => {
            if (checked) {
              onAssignmentFilterChange('unassigned');
            } else {
              onAssignmentFilterChange('all');
            }
          }}
          aria-label="Show only unassigned issues"
        />
        <Label htmlFor="filter-issue-unassigned" className="text-sm">
          Unassigned
        </Label>
      </div>

      {hasBots && (
        <div className="flex items-center space-x-2">
          <Switch
            id="filter-issue-bots"
            checked={includeBots}
            onCheckedChange={onIncludeBotsChange}
            aria-label="Show or hide issues from bots"
          />
          <Label htmlFor="filter-issue-bots" className="text-sm">
            Show Bots
          </Label>
        </div>
      )}

      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="ml-auto"
          aria-label="Reset all issue filters to default"
        >
          Reset Filters
        </Button>
      )}
    </div>
  );
}
