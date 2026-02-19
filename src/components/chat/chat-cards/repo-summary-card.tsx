import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, GitFork, Code, AlertCircle, GitPullRequest } from '@/components/ui/icon';
import type { RepoSummaryData } from '../types';

interface RepoSummaryCardProps {
  data: RepoSummaryData;
}

export function RepoSummaryCard({ data }: RepoSummaryCardProps) {
  if ('error' in data || data.stars == null) {
    return (
      <Card className="p-3 bg-muted/50 border-border">
        <p className="text-sm text-muted-foreground">Repository summary unavailable.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20">
      <div className="space-y-3">
        {data.description && <p className="text-xs text-muted-foreground">{data.description}</p>}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            <span className="font-medium">{data.stars.toLocaleString()}</span>
            <span className="text-muted-foreground">stars</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <GitFork className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{data.forks.toLocaleString()}</span>
            <span className="text-muted-foreground">forks</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{data.openIssues.toLocaleString()}</span>
            <span className="text-muted-foreground">issues</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{data.recentPRs}</span>
            <span className="text-muted-foreground">PRs ({data.timeRangeDays}d)</span>
          </div>
        </div>

        {data.language && (
          <div className="flex items-center gap-1.5">
            <Code className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Badge variant="outline" className="text-xs">
              {data.language}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
