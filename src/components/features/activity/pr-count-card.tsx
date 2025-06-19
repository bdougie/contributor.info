import { GitPullRequest } from "lucide-react";
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
      <Card className="p-3">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Open</span>
      </div>
      <p className="text-2xl font-bold mt-2">{openPRs}</p>
      <p className="text-xs text-muted-foreground">
        of {totalPRs} total
      </p>
    </Card>
  );
}