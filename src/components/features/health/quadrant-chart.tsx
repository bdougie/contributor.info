import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { PullRequest, QuadrantData } from '@/lib/types';
import { ContributionAnalyzer } from '@/lib/contribution-analyzer';
import { ContributorHoverCard } from '../contributor';
import { FileHoverInfo } from '@/components/common/cards';

interface QuadrantChartProps {
  data: PullRequest[];
  quadrants: QuadrantData[];
}

const QUADRANTS = {
  REFINEMENT: {
    label: 'Refinement',
    x: 25,
    y: 25,
  },
  NEW_STUFF: {
    label: 'New Stuff',
    x: 75,
    y: 25,
  },
  MAINTENANCE: {
    label: 'Maintenance',
    x: 25,
    y: 75,
  },
  REFACTORING: {
    label: 'Refactoring',
    x: 75,
    y: 75,
  },
};

export function QuadrantChart({ _data, quadrants }: QuadrantChartProps) {
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
        { name: '', changes: 0 },
      ).name;

      const totalAdditions = commits.reduce((sum, commit) => sum + commit.additions, 0);
      const totalDeletions = commits.reduce((sum, commit) => sum + commit.deletions, 0);

      // Extract files touched information
      const filesTouched = commits.map((commit) => ({
        name: commit.language,
        additions: commit.additions,
        deletions: commit.deletions,
      }));

      return {
        ...metrics,
        language: mainLanguage,
        pr,
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
          filesTouched: filesTouched,
        },
      };
    });
  }, [data]);

  return (
    <TooltipProvider>
      {/* Mobile placeholder - only shown on small screens */}
      <div className="md:hidden flex flex-col items-center justify-center p-6 border rounded-lg bg-background text-center space-y-4">
        <div className="w-16 h-16 text-muted-foreground animate-pulse">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium">Desktop Recommended</h3>
        <p className="text-sm text-muted-foreground">
          For a better experience, view this chart on a desktop as it's optimized for larger
          screens.
        </p>
      </div>

      {/* Desktop chart - hidden on small screens, shown on medium and up */}
      <div className="hidden md:block relative w-full aspect-[16/9] bg-background border rounded-lg mx-auto overflow-hidden">
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
        {Object.entries(QUADRANTS).map(([key, { label, x, y }]) => {
          const quadrant = quadrants.find((q) => q.name === label);
          const authors = quadrant?.authors || [];

          return (
            <div
              key={key}
              className="absolute flex items-center gap-2 group"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="flex -space-x-2">
                {authors.slice(0, 3).map((author, index) => {
                  // Use type assertion with the actual expected interface
                  const authorContributions =
                    'contributions' in author ? (author.contributions as number) : 0;

                  // Create a minimal ContributorStats object for each author
                  const contributorStats = {
                    login: author.login,
                    avatar_url: `https://avatars.githubusercontent.com/u/${author.id ?? 0}`,
                    pullRequests: authorContributions || 0,
                    percentage: ((authorContributions || 0) / (_data.length || 1)) * 100,
                    recentPRs: data.filter((pr) => pr.author?.login === author.login).slice(0, 5), // Get up to 5 recent PRs
                  };

                  return (
                    <ContributorHoverCard
                      key={`${label}-${author.id || index}-${index}`}
                      contributor={contributorStats}
                    >
                      <Avatar className="w-6 h-6 border-2 border-background cursor-pointer">
                        <AvatarImage
                          src={`https://avatars.githubusercontent.com/u/${author.id ?? 0}`}
                          alt={author.login}
                        />
                        <AvatarFallback className="bg-primary text-[8px]">
                          {author.login.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </ContributorHoverCard>
                  );
                })}
                {authors.length > 3 && (
                  <Avatar className="w-6 h-6 border-2 border-background cursor-pointer">
                    <AvatarFallback className="bg-primary text-[8px]">
                      +{authors.length - 3}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {/* Update label to "Files Touched" */}
                  {quadrant?.count || 0} files touched
                </span>
              </div>
            </div>
          );
        })}

        {/* Data points */}
        {chartData.map((point, i) => (
          <FileHoverInfo
            key={`point-${point.pr.id || point.pr.number}-${i}`}
            pullRequest={point.pr}
            filesTouched={point.stats.filesTouched}
          >
            <a
              href={point.pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute w-2 h-2 rounded-full bg-primary hover:w-3 hover:h-3 transition-all hover:bg-primary hover:opacity-80 z-10"
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: 0.6,
              }}
            />
          </FileHoverInfo>
        ))}
      </div>
    </TooltipProvider>
  );
}
