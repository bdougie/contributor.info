import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { useRepositorySummary } from "@/hooks/use-repository-summary";

interface RepositorySummaryCardProps {
  owner: string;
  repo: string;
  pullRequests?: any[];
  className?: string;
}

export function RepositorySummaryCard({ 
  owner, 
  repo, 
  pullRequests = [],
  className = ""
}: RepositorySummaryCardProps) {
  const { summary, loading, error, refetch } = useRepositorySummary(owner, repo, pullRequests);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Repository Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            AI Repository Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-3">
            Unable to generate AI summary: {error}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refetch}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          AI Repository Summary
          <Badge variant="secondary" className="ml-auto">
            AI Generated
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-foreground leading-relaxed">
            {summary}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Generated using recent repository activity
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refetch}
            className="gap-2 h-8"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}