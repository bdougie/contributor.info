import { useState } from "react";
import { PullRequestInsights } from "./PullRequestInsights";

interface RepoInsightsContainerProps {
  owner: string;
  repo: string;
}

export function RepoInsightsContainer({
  owner,
  repo,
}: RepoInsightsContainerProps) {
  const [dateRange] = useState<{
    startDate?: Date;
    endDate?: Date;
  }>({});

  // You could add date range pickers here that update the dateRange state

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Repository Insights: {owner}/{repo}
      </h1>

      {/* Date range controls could go here */}

      {/* PR Insights */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
        <PullRequestInsights owner={owner} repo={repo} dateRange={dateRange} />
      </div>

      {/* You could add other insight components here */}
    </div>
  );
}
