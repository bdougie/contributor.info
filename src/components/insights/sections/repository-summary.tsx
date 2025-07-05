import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useRepositorySummary } from "@/hooks/use-repository-summary";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { Markdown } from "@/components/common/layout";

interface RepositorySummaryProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function RepositorySummary({ owner, repo, timeRange }: RepositorySummaryProps) {
  const { stats } = useCachedRepoData(owner, repo, timeRange, false);
  const { summary, loading, error, refetch } = useRepositorySummary(owner, repo, stats.pullRequests);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Unable to generate summary</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refetch}
          className="gap-2 w-full"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-sm text-muted-foreground">
        No summary available yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Markdown className="text-sm prose-sm prose-p:mb-2 prose-p:leading-relaxed prose-code:text-xs">
        {summary}
      </Markdown>
      <div className="flex items-center justify-between pt-2">
        <Badge variant="secondary" className="text-xs">
          AI Generated
        </Badge>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refetch}
          className="gap-1 h-7 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>
    </div>
  );
}