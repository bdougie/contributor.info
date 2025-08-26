import { useState } from "react"
import { Loader2, MessageSquare, AlertCircle } from '@/components/ui/icon';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { analyzePullRequests } from "@/lib/insights/pullRequests";
import { useParams } from "react-router-dom";

export function InsightsDrawer() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      // Verify we have owner/repo from URL parameters
      if (!owner || !repo) {
        throw new Error(
          "Repository information not available. Please check the URL."
        );
      }

      console.log('Analyzing repository: %s/%s', owner, repo);

      // Use the local analysis function
      const analysisResult = await analyzePullRequests(owner, repo);
      console.log("Analysis result:", analysisResult);

      if (analysisResult.totalPRs === 0) {
        throw new Error("No pull requests available for analysis");
      }

      // Generate markdown insights based on the analysis results
      const insightsMarkdown = generateMarkdownInsights(
        owner,
        repo,
        analysisResult
      );
      setInsights(insightsMarkdown);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate insights";
      console.error("Error generating insights:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Function to generate markdown insights from the analysis results
  const generateMarkdownInsights = (
    owner: string,
    repo: string,
    analysis: {
      totalPRs: number;
      averageTimeToMerge: number;
      prsByAuthor: Record<string, number>;
      prMergeTimesByAuthor: Record<string, number[]>;
    }
  ): string => {
    // Create sorted lists of contributors
    const topContributors = Object.entries(analysis.prsByAuthor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Calculate fastest/slowest merge times
    const authorMergeTimes: Record<string, number> = {};
    for (const [author, times] of Object.entries(
      analysis.prMergeTimesByAuthor
    )) {
      if (times.length > 0) {
        authorMergeTimes[author] =
          times.reduce((sum, time) => sum + time, 0) / times.length;
      }
    }

    const fastestMergers = Object.entries(authorMergeTimes)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);

    const slowestMergers = Object.entries(authorMergeTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return `
# ${owner}/${repo} Pull Request Analysis

## Overview
This repository has **${
      analysis.totalPRs
    } pull requests** in the analyzed time period. The average time to merge a PR is **${analysis.averageTimeToMerge.toFixed(
      1
    )} hours** (about ${(analysis.averageTimeToMerge / 24).toFixed(1)} days).

## Top Contributors
${topContributors
  .map((c, i) => `${i + 1}. **${c[0]}** - ${c[1]} PRs`)
  .join("\n")}

## Merge Time Statistics
### Fastest Merged PRs
${
  fastestMergers.length > 0
    ? fastestMergers
        .map((c, i) => `${i + 1}. **${c[0]}** - ${c[1].toFixed(1)} hours`)
        .join("\n")
    : "No merge time data available."
}

### Slowest Merged PRs
${
  slowestMergers.length > 0
    ? slowestMergers
        .map((c, i) => `${i + 1}. **${c[0]}** - ${c[1].toFixed(1)} hours`)
        .join("\n")
    : "No merge time data available."
}

## Health Assessment
${getHealthAssessment(analysis)}
`;
  };

  // Generate a health assessment based on the analysis
  const getHealthAssessment = (analysis: {
    totalPRs: number;
    averageTimeToMerge: number;
    prsByAuthor: Record<string, number>;
  }): string => {
    // Calculate how distributed the contributions are
    const totalAuthors = Object.keys(analysis.prsByAuthor).length;
    const totalPRs = analysis.totalPRs;

    // Check merge time (below 24 hours is good)
    const mergeTimeAssessment =
      analysis.averageTimeToMerge <= 24
        ? "The average merge time is good, suggesting an efficient review process."
        : analysis.averageTimeToMerge <= 72
        ? "The average merge time is acceptable but could be improved."
        : "The average merge time is quite long, which could indicate review bottlenecks.";

    // Check contribution distribution
    const topContributorCount = Object.values(analysis.prsByAuthor).reduce(
      (count, prCount) => {
        return count + (prCount > totalPRs * 0.1 ? 1 : 0);
      },
      0
    );

    const distributionAssessment =
      totalAuthors === 1
        ? "This repository has only one contributor, which presents a high bus factor risk."
        : topContributorCount <= 3 && totalAuthors >= 5
        ? "The repository has a healthy distribution of contributors."
        : "The repository has a concentration of contributions among a few developers.";

    return `
### Observations
- ${mergeTimeAssessment}
- ${distributionAssessment}
- This repository has ${totalAuthors} unique contributors.

### Recommendations
${
  analysis.averageTimeToMerge > 72
    ? "- Consider streamlining your PR review process to reduce merge times.\n"
    : ""
}${
      topContributorCount === 1 && totalAuthors === 1
        ? "- Onboard more contributors to reduce the bus factor risk.\n"
        : ""
    }${
      topContributorCount > totalAuthors * 0.4 && totalAuthors > 1
        ? "- Encourage more distributed contribution across the team.\n"
        : ""
    }${
      analysis.totalPRs < 10
        ? "- There are relatively few PRs to analyze. Consider a longer time frame for better insights.\n"
        : ""
    }
`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg"
          onClick={() => {
            setIsOpen(true);
            if (!insights && !loading) {
              generateInsights();
            }
          }}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] h-full">
        <SheetHeader>
          <SheetTitle>Pull Request Insights</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-6 pr-4">
          {loading
? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )
: error
? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Error generating insights</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={generateInsights}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )
: insights
? (
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          )
: (
            <div className="text-muted-foreground">
              No insights available. Click generate to analyze pull requests.
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
