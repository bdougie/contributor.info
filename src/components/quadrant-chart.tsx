import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { PullRequest, QuadrantData } from "@/lib/types";
import { ContributionAnalyzer } from "@/lib/contribution-analyzer";

interface QuadrantChartProps {
  data: PullRequest[];
  quadrants: QuadrantData[];
}

const QUADRANTS = {
  REFINEMENT: {
    label: "Refinement",
    x: 25,
    y: 25,
    description: "Code cleanup and removal",
  },
  NEW_STUFF: {
    label: "New Stuff",
    x: 75,
    y: 25,
    description: "New features and additions",
  },
  MAINTENANCE: {
    label: "Maintenance",
    x: 25,
    y: 75,
    description: "Configuration and dependencies",
  },
  REFACTORING: {
    label: "Refactoring",
    x: 75,
    y: 75,
    description: "Code improvements",
  },
};

export function QuadrantChart({ data, quadrants }: QuadrantChartProps) {
  const chartData = useMemo(() => {
    return data.map((pr) => {
      const metrics = ContributionAnalyzer.analyze(pr);

      // Handle potentially undefined commits
      const commits = pr.commits || [];

      const mainLanguage = commits.reduce(
        (acc, commit) => {
          if (!acc || commit.additions + commit.deletions > acc.changes) {
            return {
              name: commit.language,
              changes: commit.additions + commit.deletions,
            };
          }
          return acc;
        },
        { name: "", changes: 0 }
      ).name;

      const totalAdditions = commits.reduce(
        (sum, commit) => sum + commit.additions,
        0
      );
      const totalDeletions = commits.reduce(
        (sum, commit) => sum + commit.deletions,
        0
      );

      return {
        ...metrics,
        language: mainLanguage,
        pr,
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
        },
      };
    });
  }, [data]);

  const quadrantCounts = useMemo(() => {
    return chartData.reduce(
      (acc, point) => {
        acc[point.quadrant]++;
        return acc;
      },
      { refinement: 0, newStuff: 0, maintenance: 0, refactoring: 0 }
    );
  }, [chartData]);

  return (
    <TooltipProvider>
      <div className="relative w-full aspect-[16/9] bg-background border rounded-lg overflow-hidden mx-auto">
        {/* Grid lines */}
        <div className="absolute inset-0 border-dashed border-muted">
          <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-muted" />
          <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-muted" />
        </div>

        {/* Axis labels */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground">
          Deletions →
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
          Additions →
        </div>

        {/* Quadrant labels */}
        {Object.entries(QUADRANTS).map(
          ([key, { label, x, y, description }]) => {
            const quadrant = quadrants.find((q) => q.name === label);
            const authors = quadrant?.authors || [];

            return (
              <div
                key={key}
                className="absolute flex items-center gap-2"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="flex -space-x-2">
                  {authors.slice(0, 3).map((author, index) => (
                    <Avatar
                      key={`${label}-${author.id}-${index}`}
                      className="w-6 h-6 border-2 border-background"
                    >
                      <AvatarImage
                        src={`https://avatars.githubusercontent.com/u/${author.id}`}
                        alt={author.login}
                      />
                      <AvatarFallback className="bg-primary text-[8px]">
                        {author.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {authors.length > 3 && (
                    <Avatar className="w-6 h-6 border-2 border-background">
                      <AvatarFallback className="bg-primary text-[8px]">
                        +{authors.length - 3}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {
                      quadrantCounts[
                        key.toLowerCase() as keyof typeof quadrantCounts
                      ]
                    }{" "}
                    files
                  </span>
                  <span className="text-xs text-muted-foreground hidden group-hover:block">
                    {description}
                  </span>
                </div>
              </div>
            );
          }
        )}

        {/* Data points */}
        {chartData.map((point, i) => (
          <Tooltip key={`point-${point.pr.id || point.pr.number}-${i}`}>
            <TooltipTrigger asChild>
              <a
                href={point.pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute w-2 h-2 rounded-full bg-primary hover:w-3 hover:h-3 transition-all hover:bg-primary hover:opacity-80"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: "translate(-50%, -50%)",
                  opacity: 0.6,
                }}
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <div className="space-y-2">
                <div className="font-medium">{point.pr.title}</div>
                <div className="text-xs text-muted-foreground">
                  #{point.pr.number} by {point.pr.author?.login || "Unknown"} ·{" "}
                  {point.pr.createdAt
                    ? format(new Date(point.pr.createdAt), "MMM d, yyyy")
                    : "Unknown date"}
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-500">
                    +{point.stats.additions}
                  </span>
                  <span className="text-red-500">-{point.stats.deletions}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Main language: {point.language || "Unknown"}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
