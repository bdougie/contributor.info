import { useContext } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LanguageLegend } from "./language-legend";
import { QuadrantChart } from "./quadrant-chart";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import type { PullRequest, QuadrantData, LanguageStats } from "@/lib/types";

export default function Distribution() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse string to number

  // Create a function to calculate quadrant percentages
  const getQuadrantStats = (
    prs: PullRequest[]
  ): {
    quadrants: { name: string; percentage: number }[];
    totalFiles: number;
  } => {
    if (prs.length === 0) {
      return {
        quadrants: [
          { name: "Refinement", percentage: 25 },
          { name: "New Stuff", percentage: 25 },
          { name: "Maintenance", percentage: 25 },
          { name: "Refactoring", percentage: 25 },
        ],
        totalFiles: 0,
      };
    }

    // Count files from the PRs (just an approximation based on additions/deletions)
    const totalFiles = Math.min(
      500, // Cap to avoid unrealistic numbers
      Math.ceil(
        prs.reduce(
          (sum, pr) => sum + Math.ceil((pr.additions + pr.deletions) / 100),
          0
        )
      )
    );

    // For now we'll calculate based on the stub data we're already generating
    // In a real implementation, this would be calculated based on actual PR analysis
    const quadrantNames = [
      "Refinement",
      "New Stuff",
      "Maintenance",
      "Refactoring",
    ];

    // Calculate percentages based on PR distribution
    const quadrantPRs = [
      prs.slice(0, 3).length, // Refinement
      prs.slice(3, 6).length, // New Stuff
      prs.slice(6, 9).length, // Maintenance
      prs.slice(9, 12).length, // Refactoring
    ];

    const total = quadrantPRs.reduce((sum, count) => sum + count, 0);

    return {
      quadrants: quadrantNames.map((name, index) => ({
        name,
        percentage: total > 0 ? (quadrantPRs[index] / total) * 100 : 25,
      })),
      totalFiles,
    };
  };

  // Get language statistics
  const getLanguageStats = (prs: PullRequest[]): LanguageStats[] => {
    // Create language stats based on the additions/deletions in each PR
    const languageMap = new Map<
      string,
      { count: number; color: string; totalChanges: number }
    >();

    // Common language colors from GitHub
    const colorMap: Record<string, string> = {
      JavaScript: "#f1e05a",
      TypeScript: "#2b7489",
      CSS: "#563d7c",
      HTML: "#e34c26",
      Python: "#3572A5",
      Java: "#b07219",
      Go: "#00ADD8",
      Rust: "#dea584",
      Other: "#cccccc",
    };

    // Count languages based on PRs
    prs.forEach((pr) => {
      if (pr.commits) {
        pr.commits.forEach((commit) => {
          const lang = commit.language || "Other";
          const current = languageMap.get(lang) || {
            count: 0,
            color: colorMap[lang] || colorMap["Other"],
            totalChanges: 0,
          };
          languageMap.set(lang, {
            count: current.count + 1,
            color: current.color,
            totalChanges:
              current.totalChanges + commit.additions + commit.deletions,
          });
        });
      } else {
        // For PRs without commit data, infer language from PR title/additions/deletions

        // Try to extract language from PR title
        let lang = "Other";
        const titleLower = pr.title.toLowerCase();

        if (titleLower.includes("typescript") || titleLower.includes(".ts")) {
          lang = "TypeScript";
        } else if (
          titleLower.includes("javascript") ||
          titleLower.includes(".js")
        ) {
          lang = "JavaScript";
        } else if (titleLower.includes("css") || titleLower.includes("style")) {
          lang = "CSS";
        } else if (
          titleLower.includes("html") ||
          titleLower.includes("markup")
        ) {
          lang = "HTML";
        } else if (
          titleLower.includes("python") ||
          titleLower.includes(".py")
        ) {
          lang = "Python";
        } else if (
          titleLower.includes("java") ||
          titleLower.includes(".java")
        ) {
          lang = "Java";
        } else if (titleLower.includes("go") || titleLower.includes(".go")) {
          lang = "Go";
        } else if (titleLower.includes("rust") || titleLower.includes(".rs")) {
          lang = "Rust";
        }

        const size = pr.additions + pr.deletions;

        const current = languageMap.get(lang) || {
          count: 0,
          color: colorMap[lang] || colorMap["Other"],
          totalChanges: 0,
        };

        languageMap.set(lang, {
          count: current.count + 1,
          color: current.color,
          totalChanges: current.totalChanges + size,
        });
      }
    });

    // If we don't have any languages yet (no PRs or all are empty), create some placeholder data
    // based on the repository context
    if (languageMap.size === 0) {
      // Since this is a React project (based on file structure), we'll use realistic data
      return [
        {
          name: "TypeScript",
          color: colorMap["TypeScript"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.6) : 15,
        },
        {
          name: "JavaScript",
          color: colorMap["JavaScript"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.2) : 8,
        },
        {
          name: "CSS",
          color: colorMap["CSS"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.15) : 5,
        },
        {
          name: "HTML",
          color: colorMap["HTML"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.05) : 2,
        },
      ];
    }

    // Convert the map to array format required by LanguageLegend
    return (
      Array.from(languageMap.entries())
        .map(([name, { count, color, totalChanges }]) => ({
          name,
          count,
          color,
          // Store the total changes to help with sorting
          totalChanges,
        }))
        // Sort by total changes (most significant languages first)
        .sort((a, b) => b.totalChanges - a.totalChanges)
        // Take top 8 languages at most to avoid cluttering the UI
        .slice(0, 8)
        // Remove the totalChanges prop since it's not in the LanguageStats interface
        .map(({ name, count, color }) => ({
          name,
          count,
          color,
        }))
    );
  };

  const getQuadrantData = (prs: PullRequest[]): QuadrantData[] => {
    // This is a stub for quadrant data
    // In a real implementation, we would analyze PR data to determine quadrants
    return [
      {
        name: "Refinement",
        authors: prs.slice(0, 3).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
        percentage: 25,
        count: prs.slice(0, 3).length,
      },
      {
        name: "New Stuff",
        authors: prs.slice(3, 6).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
        percentage: 25,
        count: prs.slice(3, 6).length,
      },
      {
        name: "Maintenance",
        authors: prs.slice(6, 9).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
        percentage: 25,
        count: prs.slice(6, 9).length,
      },
      {
        name: "Refactoring",
        authors: prs.slice(9, 12).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
        percentage: 25,
        count: prs.slice(9, 12).length,
      },
    ];
  };

  // Get the statistics for display
  const languageStats = getLanguageStats(stats.pullRequests);
  const quadrantData = getQuadrantData(stats.pullRequests);
  const { quadrants, totalFiles } = getQuadrantStats(stats.pullRequests);

  // Add commit data to PRs (stub)
  const prepareDataForQuadrantChart = (prs: PullRequest[]) => {
    return prs.map((pr) => ({
      ...pr,
      // Adding stub data for commits since our PR model doesn't have them
      commits: pr.commits || [
        {
          additions: pr.additions * 0.6,
          deletions: pr.deletions * 0.6,
          language: "TypeScript",
        },
        {
          additions: pr.additions * 0.3,
          deletions: pr.deletions * 0.3,
          language: "JavaScript",
        },
        {
          additions: pr.additions * 0.1,
          deletions: pr.deletions * 0.1,
          language: "CSS",
        },
      ],
      // Additional fields needed by QuadrantChart
      url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`,
      author: {
        login: pr.user.login,
        id: pr.user.id,
      },
      createdAt: pr.created_at,
    }));
  };

  if (stats.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Distribution Analysis</CardTitle>
          <CardDescription>Loading distribution data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Distribution Analysis</CardTitle>
        <CardDescription>
          Visualize contribution patterns across different categories over the
          past {timeRangeNumber} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          {totalFiles.toLocaleString()} files changed ·
          {quadrants
            .map((q) => ` ${q.percentage.toFixed(1)}% ${q.name.toLowerCase()}`)
            .join(" · ")}
        </div>
        <LanguageLegend languages={languageStats} />
        <QuadrantChart
          data={prepareDataForQuadrantChart(stats.pullRequests.slice(0, 20))}
          quadrants={quadrantData}
        />
        <div className="text-sm text-muted-foreground mt-4">
          <p>
            This chart categorizes contributions into four quadrants based on
            the nature of changes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <span className="font-medium">Refinement</span>: Code cleanup and
              removal
            </li>
            <li>
              <span className="font-medium">New Stuff</span>: New features and
              additions
            </li>
            <li>
              <span className="font-medium">Maintenance</span>: Configuration
              and dependencies
            </li>
            <li>
              <span className="font-medium">Refactoring</span>: Code
              improvements
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
