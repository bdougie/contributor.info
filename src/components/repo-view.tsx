import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, SearchIcon, Users, MonitorPlay } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginDialog } from './login-dialog';
import { ContributorHoverCard } from './contributor-hover-card';
import { supabase } from '@/lib/supabase';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchPullRequests } from '@/lib/github';
import { humanizeNumber, calculateLotteryFactor } from '@/lib/utils';
import type { PullRequest, RepoStats, LotteryFactor, ContributorStats } from '@/lib/types';

function LotteryFactorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div className="text-xl font-semibold flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" />
          Lottery Factor
        </div>
        <Skeleton className="ml-auto h-6 w-16" />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32 mt-1" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-2 w-[200px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LotteryFactorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">No data available</h3>
      <p className="text-sm text-muted-foreground mt-2">
        This repository doesn't have enough commit data to calculate the Lottery Factor.
      </p>
    </div>
  );
}

function LotteryFactorContent({ stats, lotteryFactor }: { stats: RepoStats; lotteryFactor: LotteryFactor | null }) {
  if (stats.loading) {
    return <LotteryFactorSkeleton />;
  }

  if (!lotteryFactor || lotteryFactor.contributors.length === 0) {
    return <LotteryFactorEmpty />;
  }

  const getRiskLevelColor = (level: 'Low' | 'Medium' | 'High') => {
    switch (level) {
      case 'Low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'High':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    }
  };

  const getProgressBarSegments = (contributors: ContributorStats[]) => {
    const colors = [
      'bg-orange-500 hover:bg-orange-600',
      'bg-orange-400 hover:bg-orange-500',
      'bg-yellow-500 hover:bg-yellow-600',
      'bg-green-500 hover:bg-green-600',
      'bg-blue-500 hover:bg-blue-600',
    ];

    const otherContributorsPercentage = 100 - contributors.reduce((sum, c) => sum + c.percentage, 0);

    return [
      ...contributors.map((contributor, index) => ({
        color: colors[index % colors.length],
        width: `${contributor.percentage}%`,
        contributor,
      })),
      {
        color: 'bg-gray-400 hover:bg-gray-500',
        width: `${otherContributorsPercentage}%`,
        contributor: null,
      },
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div className="text-xl font-semibold flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" />
          Lottery Factor
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  The Lottery Factor measures the distribution of contributions 
                  across maintainers. A high percentage indicates increased risk 
                  due to concentrated knowledge.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge 
          variant="secondary" 
          className={`ml-auto ${getRiskLevelColor(lotteryFactor.riskLevel)}`}
        >
          {lotteryFactor.riskLevel}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            The top {lotteryFactor.topContributorsCount} contributors of this repository have made{' '}
            <span className="font-medium text-foreground">
              {lotteryFactor.topContributorsPercentage}%
            </span>{' '}
            of all pull requests in the past 30 days.
          </div>
          
          <div className="h-2 w-full rounded-full overflow-hidden flex">
            {getProgressBarSegments(lotteryFactor.contributors).map((segment, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-full transition-colors ${segment.color}`}
                      style={{ width: segment.width }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      {segment.contributor ? (
                        <>
                          <img
                            src={segment.contributor.avatar_url}
                            alt={segment.contributor.login}
                            className="w-4 h-4 rounded-full"
                          />
                          <span>{segment.contributor.login}</span>
                          <span className="text-muted-foreground">
                            ({Math.round(segment.contributor.percentage)}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4" />
                          <span>Other contributors</span>
                          <span className="text-muted-foreground">
                            ({Math.round(parseFloat(segment.width))}%)
                          </span>
                        </>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_100px_80px] gap-4 text-sm text-muted-foreground">
            <div>Contributor</div>
            <div className="text-right">Pull Requests</div>
            <div className="text-right">% of total</div>
          </div>
          
          {lotteryFactor.contributors.map((contributor, index) => (
            <div key={contributor.login} className="grid grid-cols-[1fr_100px_80px] gap-4 items-center">
              <div className="flex items-center gap-2">
                <ContributorHoverCard 
                  contributor={contributor}
                  role={index === 0 ? 'maintainer' : index === 1 ? 'member' : 'contributor'}
                >
                  <img
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    className="h-8 w-8 rounded-full cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  />
                </ContributorHoverCard>
                <div>
                  <div className="font-medium">{contributor.login}</div>
                  <div className="text-sm text-muted-foreground">
                    {index === 0 ? 'maintainer' : index === 1 ? 'member' : 'contributor'}
                  </div>
                </div>
              </div>
              <div className="text-right font-medium">
                {contributor.pullRequests}
              </div>
              <div className="text-right font-medium">
                {Math.round(contributor.percentage)}%
              </div>
            </div>
          ))}
          
          <div className="border-t pt-4">
            <div className="grid grid-cols-[1fr_100px_80px] gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">Other contributors</div>
                  <div className="text-sm text-muted-foreground">
                    {lotteryFactor.totalContributors - lotteryFactor.contributors.length} contributors
                  </div>
                </div>
              </div>
              <div className="text-right font-medium">
                {stats.pullRequests.length - lotteryFactor.contributors.reduce((sum, c) => sum + c.pullRequests, 0)}
              </div>
              <div className="text-right font-medium">
                {Math.round(100 - lotteryFactor.contributors.reduce((sum, c) => sum + c.percentage, 0))}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContributionsChart({ stats, enhanceView, setEnhanceView }: { 
  stats: RepoStats; 
  enhanceView: boolean;
  setEnhanceView: (value: boolean) => void;
}) {
  const getChartData = () => {
    // Sort by updated_at and take only the last 50 PRs
    const recentPRs = [...stats.pullRequests]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 50);

    return recentPRs.map((pr, index) => {
      const daysAgo = Math.floor(
        (new Date().getTime() - new Date(pr.updated_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const linesChanged = pr.additions + pr.deletions;
      
      // Only show avatars for the first 25 PRs
      const showAvatar = index < 25;

      return {
        daysAgo,
        linesChanged: enhanceView
          ? Math.min(
              linesChanged,
              recentPRs[Math.floor(recentPRs.length * 0.25)].additions +
                recentPRs[Math.floor(recentPRs.length * 0.25)].deletions
            )
          : linesChanged,
        avatar: showAvatar ? pr.user.avatar_url : null,
        state: pr.state,
        merged: pr.merged_at !== null,
        title: pr.title,
        number: pr.number,
        author: pr.user.login,
        repository_owner: pr.repository_owner,
        repository_name: pr.repository_name,
        url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="enhance-view"
          checked={enhanceView}
          onCheckedChange={setEnhanceView}
        />
        <Label htmlFor="enhance-view">Focus on smaller contributions</Label>
      </div>
      <div className="h-[600px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="daysAgo"
              name="Days Ago"
              domain={[0, 'auto']}
              reversed
              label={{ value: 'Days Ago (Last Commit)', position: 'bottom', offset: 20 }}
            />
            <YAxis
              type="number"
              dataKey="linesChanged"
              name="Lines Changed"
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={(value) => humanizeNumber(value)}
              label={{ 
                value: 'Lines Touched (in thousands)', 
                angle: -90, 
                position: 'insideLeft',
                offset: -10
              }}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background p-4 rounded-lg shadow border">
                      <div className="flex items-center gap-2 mb-2">
                        {data.avatar && (
                          <img
                            src={data.avatar}
                            alt="User avatar"
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <a
                          href={`https://github.com/${data.repository_owner}/${data.repository_name}/pull/${data.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          #{data.number}
                        </a>
                        <span>by</span>
                        <a
                          href={`https://github.com/${data.author}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {data.author}
                        </a>
                      </div>
                      <p className="text-sm">{data.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {humanizeNumber(data.linesChanged)} lines changed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.daysAgo} days ago
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              data={getChartData()}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <a 
                    href={payload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                  >
                    {payload.avatar ? (
                      <image
                        x={cx - 10}
                        y={cy - 10}
                        width={20}
                        height={20}
                        href={payload.avatar}
                        clipPath="circle(50%)"
                        style={{ cursor: 'pointer' }}
                      />
                    ) : (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="hsl(var(--muted-foreground))"
                        opacity={0.5}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </a>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<RepoStats>({
    pullRequests: [],
    loading: true,
    error: null,
  });
  const [enhanceView, setEnhanceView] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lotteryFactor, setLotteryFactor] = useState<LotteryFactor | null>(null);

  useEffect(() => {
    // Check login status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session && showLoginDialog) {
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
        const prs = await fetchPullRequests(owner, repo);
        setStats({ pullRequests: prs, loading: false, error: null });
        setLotteryFactor(calculateLotteryFactor(prs));
      } catch (error) {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
        }));
      }
    }

    loadPRData();
  }, [owner, repo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract owner and repo from input
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
              <h2 className="text-2xl font-semibold text-destructive mb-2">Error</h2>
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
            {/* Mobile view with tabs */}
            <div className="lg:hidden">
              <Tabs defaultValue="lottery" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="lottery">Lottery Factor</TabsTrigger>
                  <TabsTrigger value="contributions">Contributions</TabsTrigger>
                </TabsList>
                
                <TabsContent value="lottery">
                  <LotteryFactorContent stats={stats} lotteryFactor={lotteryFactor} />
                </TabsContent>

                <TabsContent value="contributions">
                  <ContributionsChart stats={stats} enhanceView={enhanceView} setEnhanceView={setEnhanceView} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop view with side-by-side charts */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(650px,1fr)_1fr] lg:gap-8">
              <div>
                <LotteryFactorContent stats={stats} lotteryFactor={lotteryFactor} />
              </div>
              <div>
                <ContributionsChart stats={stats} enhanceView={enhanceView} setEnhanceView={setEnhanceView} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}