import { useState, useEffect } from "react";
import { PullRequestActivity } from "@/types/pr-activity";
import type { PullRequest } from "@/lib/types";

function formatTimestamp(date: string): string {
  const now = new Date();
  const timestamp = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

export function usePRActivity(pullRequests: PullRequest[]) {
  const [activities, setActivities] = useState<PullRequestActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      setLoading(true);
      const processedActivities: PullRequestActivity[] = [];

      // Process pull requests
      pullRequests.forEach((pr) => {
        const repoUrl = pr.html_url.split("/pull/")[0];
        const [owner, repo] = repoUrl.split("github.com/")[1].split("/");

        // Add PR creation activity
        processedActivities.push({
          id: `pr-${pr.id}-open`,
          type: "opened",
          user: {
            id: pr.user.login,
            name: pr.user.login,
            avatar: pr.user.avatar_url,
          },
          pullRequest: {
            id: pr.id.toString(),
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
          },
          repository: {
            id: repo,
            name: repo,
            owner: owner,
            url: repoUrl,
          },
          timestamp: formatTimestamp(pr.created_at),
          createdAt: new Date(pr.created_at),
        });

        // Add merge or close status if applicable
        if (pr.merged_at) {
          processedActivities.push({
            id: `pr-${pr.id}-merge`,
            type: "merged",
            user: {
              id: pr.user.login,
              name: pr.user.login,
              avatar: pr.user.avatar_url,
            },
            pullRequest: {
              id: pr.id.toString(),
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
            },
            repository: {
              id: repo,
              name: repo,
              owner: owner,
              url: repoUrl,
            },
            timestamp: formatTimestamp(pr.merged_at),
            createdAt: new Date(pr.merged_at),
          });
        } else if (pr.closed_at && !pr.merged_at) {
          processedActivities.push({
            id: `pr-${pr.id}-close`,
            type: "closed",
            user: {
              id: pr.user.login,
              name: pr.user.login,
              avatar: pr.user.avatar_url,
            },
            pullRequest: {
              id: pr.id.toString(),
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
            },
            repository: {
              id: repo,
              name: repo,
              owner: owner,
              url: repoUrl,
            },
            timestamp: formatTimestamp(pr.closed_at),
            createdAt: new Date(pr.closed_at),
          });
        }

        // Add reviews if available
        if (pr.reviews) {
          pr.reviews.forEach((review, index) => {
            if (
              review.state === "APPROVED" ||
              review.state === "CHANGES_REQUESTED"
            ) {
              processedActivities.push({
                id: `review-${pr.id}-${index}`,
                type: "reviewed",
                user: {
                  id: review.user.login,
                  name: review.user.login,
                  avatar: review.user.avatar_url,
                },
                pullRequest: {
                  id: pr.id.toString(),
                  number: pr.number,
                  title: pr.title,
                  url: pr.html_url,
                },
                repository: {
                  id: repo,
                  name: repo,
                  owner: owner,
                  url: repoUrl,
                },
                timestamp: formatTimestamp(review.submitted_at || pr.updated_at),
                createdAt: new Date(review.submitted_at || pr.updated_at),
              });
            }
          });
        }

        // Add comments if available
        if (pr.comments) {
          pr.comments.forEach((comment, index) => {
            processedActivities.push({
              id: `comment-${pr.id}-${index}`,
              type: "commented",
              user: {
                id: comment.user.login,
                name: comment.user.login,
                avatar: comment.user.avatar_url,
              },
              pullRequest: {
                id: pr.id.toString(),
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
              },
              repository: {
                id: repo,
                name: repo,
                owner: owner,
                url: repoUrl,
              },
              timestamp: formatTimestamp(comment.created_at),
              createdAt: new Date(comment.created_at),
            });
          });
        }
      });

      // Sort activities by date, newest first
      const sortedActivities = processedActivities.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setActivities(sortedActivities);
      setError(null);
    } catch (err) {
      console.error("Error processing PR activity:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to process PR activity")
      );
    } finally {
      setLoading(false);
    }
  }, [pullRequests]);

  return { activities, loading, error };
}