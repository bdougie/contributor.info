import { Card } from '@/components/ui/card';
import { Trophy, GitPullRequest, Eye } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ContributorRankingsData } from '../types';

function getRankStyle(rank: number): string {
  if (rank === 0) return 'text-yellow-500';
  if (rank === 1) return 'text-gray-400';
  if (rank === 2) return 'text-orange-600 dark:text-orange-400';
  return 'text-muted-foreground';
}

interface ContributorRankingsCardProps {
  data: ContributorRankingsData;
}

export function ContributorRankingsCard({ data }: ContributorRankingsCardProps) {
  if (!data.contributors || data.contributors.length === 0) {
    return (
      <Card className="p-3 bg-muted/50 border-border">
        <p className="text-sm text-muted-foreground">No contributor data available yet.</p>
      </Card>
    );
  }

  const shown = data.contributors.slice(0, 5);

  return (
    <div className="space-y-1.5">
      {shown.map((contributor, i) => (
        <Card key={contributor.login} className="p-2.5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-bold w-5 text-center shrink-0', getRankStyle(i))}>
              {i < 3 ? <Trophy className="h-3.5 w-3.5 inline" /> : `${i + 1}`}
            </span>
            <img
              src={`https://github.com/${contributor.login}.png?size=40`}
              alt={contributor.login}
              className="w-5 h-5 rounded-full shrink-0"
              loading="lazy"
            />
            <span className="text-xs font-medium truncate flex-1">{contributor.login}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-0.5" title="PRs merged">
                <GitPullRequest className="h-3 w-3" />
                {contributor.prsMerged}
              </span>
              <span className="flex items-center gap-0.5" title="Reviews given">
                <Eye className="h-3 w-3" />
                {contributor.reviewsGiven}
              </span>
            </div>
          </div>
        </Card>
      ))}

      {data.total > shown.length && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          +{data.total - shown.length} more contributors
        </p>
      )}
    </div>
  );
}
