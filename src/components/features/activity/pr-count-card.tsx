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
        <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">PRs</span>
      </div>
      <p className="text-2xl font-bold mt-2 truncate">{openPRs}</p>
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3 text-muted-foreground" />
        <p className="text-xs text-muted-foreground truncate">
          of {totalPRs} total
        </p>
      </div>
    </Card>
  );
}