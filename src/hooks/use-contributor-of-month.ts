import { useMemo, useContext } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { ContributorActivity } from "@/lib/contributors/types";
import { createContributorRankings } from "@/lib/contributors/calculator";
import { PullRequest } from "@/lib/types";

export function useContributorOfMonth() {
  const { stats } = useContext(RepoStatsContext);

  const contributorRanking = useMemo(() => {
    if (!stats.pullRequests || stats.pullRequests.length === 0) return null;

    // Transform PR data into ContributorActivity format
    const activitiesMap = new Map<string, Partial<ContributorActivity>>();

    stats.pullRequests.forEach((pr: PullRequest) => {
      const username = pr.user?.login;
      const userId = pr.user?.id?.toString();
      if (!username || !userId) return;

      if (!activitiesMap.has(userId)) {
        activitiesMap.set(userId, {
          id: userId,
          username,
          displayName: username, // PR user object doesn't have name field
          avatarUrl: pr.user?.avatar_url || "",
          profileUrl: pr.html_url || `https://github.com/${username}`,
          pullRequests: 0,
          mergedPullRequests: 0,
          reviews: 0,
          comments: 0,
          earliestContribution: new Date(pr.created_at),
          latestContribution: new Date(pr.created_at),
          repositoriesContributed: 1,
        });
      }

      const activity = activitiesMap.get(userId)!;
      
      // Count PRs opened
      activity.pullRequests = (activity.pullRequests || 0) + 1;
      
      // Count merged PRs separately for scoring
      if (pr.merged_at) {
        activity.mergedPullRequests = (activity.mergedPullRequests || 0) + 1;
      }

      // Update contribution dates
      const prDate = new Date(pr.created_at);
      if (!activity.earliestContribution || prDate < activity.earliestContribution) {
        activity.earliestContribution = prDate;
      }
      if (!activity.latestContribution || prDate > activity.latestContribution) {
        activity.latestContribution = prDate;
      }

      // Count reviews if available
      if (pr.reviews && pr.reviews.length > 0) {
        activity.reviews = (activity.reviews || 0) + pr.reviews.length;
      }

      // Count comments if available
      if (pr.comments && pr.comments.length > 0) {
        activity.comments = (activity.comments || 0) + pr.comments.length;
      }
    });

    // Convert to complete ContributorActivity objects
    const activities: ContributorActivity[] = Array.from(activitiesMap.values())
      .filter((activity): activity is ContributorActivity => {
        return !!(
          activity.id &&
          activity.username &&
          activity.displayName &&
          activity.avatarUrl &&
          activity.profileUrl &&
          typeof activity.pullRequests === 'number' &&
          typeof activity.mergedPullRequests === 'number' &&
          typeof activity.reviews === 'number' &&
          typeof activity.comments === 'number' &&
          activity.earliestContribution &&
          activity.latestContribution &&
          typeof activity.repositoriesContributed === 'number'
        );
      });

    if (activities.length === 0) return null;

    const rankings = createContributorRankings(activities);
    return rankings;
  }, [stats.pullRequests]);

  return contributorRanking;
}