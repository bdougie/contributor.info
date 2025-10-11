import {
  TimeRangeSelector,
  type TimeRange,
} from '@/components/features/workspace/TimeRangeSelector';
import { RepositoryFilter } from '@/components/features/workspace/RepositoryFilter';
import type { Repository } from '@/components/features/workspace';

interface WorkspaceHeaderProps {
  workspaceName: string;
  workspaceDescription?: string | null;
  workspaceTier: 'free' | 'pro' | 'enterprise';
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  repositories: Repository[];
  selectedRepositories: string[];
  onRepositorySelectionChange: (selected: string[]) => void;
  onUpgradeClick: () => void;
}

export function WorkspaceHeader({
  workspaceName,
  workspaceDescription,
  workspaceTier,
  timeRange,
  onTimeRangeChange,
  repositories,
  selectedRepositories,
  onRepositorySelectionChange,
  onUpgradeClick,
}: WorkspaceHeaderProps) {
  return (
    <div className="container max-w-7xl mx-auto p-6 pb-0">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{workspaceName}</h1>
            {workspaceDescription && (
              <p className="text-muted-foreground mt-1">{workspaceDescription}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TimeRangeSelector
              value={timeRange}
              onChange={onTimeRangeChange}
              tier={workspaceTier}
              onUpgradeClick={onUpgradeClick}
              variant="select"
            />
            <RepositoryFilter
              repositories={repositories.map((repo) => ({
                id: repo.id,
                name: repo.name,
                owner: repo.owner,
                full_name: repo.full_name,
                avatar_url: repo.avatar_url,
                language: repo.language,
                last_activity: repo.last_activity,
              }))}
              selectedRepositories={selectedRepositories}
              onSelectionChange={onRepositorySelectionChange}
              className="w-[200px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
