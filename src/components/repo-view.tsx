import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchIcon } from "lucide-react";
import { LoginDialog } from "./login-dialog";
import { supabase } from "@/lib/supabase";
import { fetchPullRequests, fetchDirectCommits } from "@/lib/github";
import { calculateLotteryFactor } from "@/lib/utils";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { RepoStatsProvider } from "@/lib/repo-stats-context";
import LotteryFactor from "./lottery-factor";
import Contributions from "./contributions";
import Distribution from "./distribution";
import { ExampleRepos } from "./example-repos";
import type {
  RepoStats,
  LotteryFactor as LotteryFactorType,
  DirectCommitsData,
} from "@/lib/types";

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [stats, setStats] = useState<RepoStats>({
    pullRequests: [],
    loading: true,
    error: null,
  });
  const [searchInput, setSearchInput] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [lotteryFactor, setLotteryFactor] = useState<LotteryFactorType | null>(
    null
  );
  const [directCommitsData, setDirectCommitsData] =
    useState<DirectCommitsData | null>(null);
  const [includeBots, setIncludeBots] = useState(false);

  useEffect(() => {
    // Check login status
    supabase.auth.getSession().then(({ data: { session } }) => {
      const loggedIn = !!session;
      if (loggedIn && showLoginDialog) {
        setShowLoginDialog(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session;
      if (loggedIn && showLoginDialog) {
        setShowLoginDialog(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [showLoginDialog]);

  useEffect(() => {
    async function loadPRData() {
      if (!owner || !repo) return;

      try {
        setStats((prev) => ({ ...prev, loading: true, error: null }));

        // Fetch pull requests and direct commits in parallel
        const [prs, directCommits] = await Promise.all([
          fetchPullRequests(owner, repo, timeRange),
          fetchDirectCommits(owner, repo, timeRange),
        ]);

        setStats({ pullRequests: prs, loading: false, error: null });
        setLotteryFactor(calculateLotteryFactor(prs, timeRange, includeBots));
        setDirectCommitsData({
          hasYoloCoders: directCommits.hasYoloCoders,
          yoloCoderStats: directCommits.yoloCoderStats,
        });
      } catch (error) {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch data",
        }));
      }
    }

    loadPRData();
  }, [owner, repo, timeRange, includeBots]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const match = searchInput.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

    if (match) {
      const [, newOwner, newRepo] = match;
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  if (stats.loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-destructive mb-2">
                Error
              </h2>
              <p className="text-muted-foreground">{stats.error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />

      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="Search another repository (e.g., facebook/react)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
          <ExampleRepos onSelect={setSearchInput} />
        </CardContent>
      </Card>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {owner}/{repo}
                </CardTitle>
                <CardDescription>
                  Contribution analysis of recent pull requests
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="lottery"
              className="space-y-4"
              onValueChange={(value) => {
                navigate(
                  `/${owner}/${repo}${value === "lottery" ? "" : `/${value}`}`
                );
              }}
            >
              <TabsList>
                <TabsTrigger value="lottery">Health</TabsTrigger>
                <TabsTrigger value="contributions">Activity</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6">
              <RepoStatsProvider
                value={{
                  stats,
                  lotteryFactor,
                  directCommitsData,
                  includeBots,
                  setIncludeBots,
                }}
              >
                <Outlet />
              </RepoStatsProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Route components
export function LotteryFactorRoute() {
  return <LotteryFactor />;
}

export function ContributionsRoute() {
  return <Contributions />;
}

export function DistributionRoute() {
  return <Distribution />;
}
