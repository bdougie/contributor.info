import { GitPullRequest, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PrCountCardProps {
  openPRs: number;
  totalPRs: number;
  loading?: boolean;
}

export function PrCountCard({ openPRs, totalPRs, loading }: PrCountCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <GitPullRequest className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">PRs</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Open Pull Requests</dt>
        <dd className="text-2xl font-bold truncate">{openPRs}</dd>
        <div className="flex items-center gap-1 mt-1">
          <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Total Pull Requests</dt>
          <dd className="text-xs text-muted-foreground truncate">
            of {totalPRs} total
          </dd>
        </div>
      </dl>
    </Card>
  );
}