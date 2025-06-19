import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { GitPullRequest } from "lucide-react";
import { format } from "date-fns";
import type { PullRequest } from "@/lib/types";
import { ContributionAnalyzer } from "@/lib/contribution-analyzer";

interface ContributionHoverCardProps {
  authorId: number;
  authorLogin: string;
  pullRequests: PullRequest[];
  children: React.ReactNode;
}

// Function to get status badge styling
const getStatusBadgeStyle = (state: string, merged: boolean) => {
  if (merged)
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
  if (state === "closed")
    return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
};

// Function to get status label
const getStatusLabel = (state: string, merged: boolean) => {
  if (merged) return "merged";
  return state;
};

// Function to get quadrant display name
const getQuadrantDisplayName = (quadrant: string): string => {
  switch (quadrant) {
    case "refinement":
      return "Refinement";
    case "new":
      return "New Features";
    case "maintenance":
      return "Maintenance";
    case "refactoring":
      return "Refactoring";
    default:
      return quadrant;
  }
};

// Function to get quadrant badge styling
const getQuadrantBadgeStyle = (quadrant: string): string => {
  switch (quadrant) {
    case "refinement":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
    case "new":
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    case "maintenance":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "refactoring":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400";
    default:
      return "";
  }
};

export function ContributionHoverCard({
  authorId,
  authorLogin,
  pullRequests,
  children,
}: ContributionHoverCardProps) {
  // Filter PRs belonging to this author
  const authorPRs = pullRequests.filter((pr) => pr.user.id === authorId);

  // Group PRs by quadrant
  const prsByQuadrant = authorPRs.reduce((acc, pr) => {
    const metrics = ContributionAnalyzer.analyze(pr);
    if (!acc[metrics.quadrant]) {
      acc[metrics.quadrant] = [];
    }
    acc[metrics.quadrant].push(pr);
    return acc;
  }, {} as Record<string, PullRequest[]>);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className="w-80 max-h-[500px] overflow-y-auto z-50"
        sideOffset={5}
        align="start"
        side="right"
      >
        <div>
          <h4 className="text-sm font-semibold mb-2">
            {authorLogin}'s Contributions
          </h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitPullRequest className="h-4 w-4" />
            <span>{authorPRs.length} pull requests</span>
          </div>
        </div>

        {Object.entries(prsByQuadrant).map(([quadrant, prs]) => (
          <div key={quadrant}>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={getQuadrantBadgeStyle(quadrant)}
                >
                  {getQuadrantDisplayName(quadrant)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {prs.length}{" "}
                  {prs.length === 1 ? "contribution" : "contributions"}
                </span>
              </div>
              <div className="space-y-2">
                {prs.slice(0, 3).map((pr) => (
                  <a
                    key={pr.id}
                    href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        #{pr.number}
                      </Badge>
                      <span className="truncate">{pr.title}</span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs shrink-0 ${getStatusBadgeStyle(
                          pr.state,
                          pr.merged_at !== null
                        )}`}
                      >
                        {getStatusLabel(pr.state, pr.merged_at !== null)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(pr.created_at), "MMM d, yyyy")} · +
                      {pr.additions} -{pr.deletions}
                    </div>
                  </a>
                ))}
                {prs.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{prs.length - 3} more contributions in this category
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
