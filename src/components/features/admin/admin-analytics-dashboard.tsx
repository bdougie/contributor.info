import { useEffect, useState } from "react"
import { 
  BarChart3, Share2, TrendingUp, Users, RefreshCw, 
  Globe, GitPullRequest, MessageSquare, Eye, Database,
  Activity, Clock, Star
} from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";

interface ShareEvent {
  id: string;
  user_id: string | null;
  original_url: string;
  short_url: string | null;
  dub_link_id: string | null;
  chart_type: string;
  repository: string | null;
  page_path: string;
  action: string;
  share_type: string;
  domain: string;
  metadata: any;
  created_at: string;
}

interface SystemMetrics {
  totalRepositories: number;
  totalContributors: number;
  totalPullRequests: number;
  totalReviews: number;
  totalComments: number;
  activeUsersLast30Days: number;
  mostActiveRepo: string | null;
  recentActivity: Array<{
    type: string;
    count: number;
    repository?: string;
  }>;
}

interface ShareMetrics {
  totalShares: number;
  totalUsers: number;
  topRepositories: Array<{
    repository: string;
    shares: number;
    users: number;
  }>;
  topChartTypes: Array<{
    chart_type: string;
    shares: number;
  }>;
  sharesByAction: Array<{
    action: string;
    shares: number;
  }>;
  recentShares: ShareEvent[];
}

export function AdminAnalyticsDashboard() {
  const [shareMetrics, setShareMetrics] = useState<ShareMetrics | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemMetrics = async () => {
    try {
      // Fetch repository stats
      const { data: repoStats, error: repoError } = await supabase
        .from('repositories')
        .select('*')
        .eq('is_active', true);

      if (repoError) throw repoError;

      // Fetch contributor stats
      const { data: contributorStats, error: contributorError } = await supabase
        .from('contributors')
        .select('*')
        .eq('is_active', true)
        .eq('is_bot', false);

      if (contributorError) throw contributorError;

      // Fetch PR stats
      const { data: prStats, error: prError } = await supabase
        .from('pull_requests')
        .select('id, repository_id, created_at, author_id')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (prError) throw prError;

      // Fetch review stats
      const { data: reviewStats, error: reviewError } = await supabase
        .from('reviews')
        .select('id, reviewer_id, submitted_at')
        .gte('submitted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (reviewError) throw reviewError;

      // Fetch comment stats
      const { data: commentStats, error: commentError } = await supabase
        .from('comments')
        .select('id, commenter_id, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (commentError) throw commentError;

      // Calculate metrics
      const activeUsers = new Set([
        ...(prStats || []).map(pr => pr.author_id),
        ...(reviewStats || []).map(r => r.reviewer_id),
        ...(commentStats || []).map(c => c.commenter_id)
      ]);

      // Get total counts (all time)
      const { count: totalPRs } = await supabase
        .from('pull_requests')
        .select('*', { count: 'exact', head: true });

      const { count: totalReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });

      const { count: totalComments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true });

      // Find most active repository
      const repoActivity = (prStats || []).reduce((acc, pr) => {
        acc[pr.repository_id] = (acc[pr.repository_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostActiveRepoId = Object.entries(repoActivity)
        .sort(([,a], [,b]) => b - a)[0]?.[0];

      let mostActiveRepo = null;
      if (mostActiveRepoId) {
        const { data: repoData } = await supabase
          .from('repositories')
          .select('full_name')
          .eq('id', mostActiveRepoId)
          .single();
        mostActiveRepo = repoData?.full_name || null;
      }

      setSystemMetrics({
        totalRepositories: repoStats?.length || 0,
        totalContributors: contributorStats?.length || 0,
        totalPullRequests: totalPRs || 0,
        totalReviews: totalReviews || 0,
        totalComments: totalComments || 0,
        activeUsersLast30Days: activeUsers.size,
        mostActiveRepo,
        recentActivity: [
          { type: 'Pull Requests', count: prStats?.length || 0 },
          { type: 'Reviews', count: reviewStats?.length || 0 },
          { type: 'Comments', count: commentStats?.length || 0 }
        ]
      });

    } catch (err) {
      console.error('Failed to fetch system metrics:', err);
      throw err;
    }
  };

  const fetchShareMetrics = async () => {
    try {
      // Fetch recent share events
      const { data: shareEvents, error: eventsError } = await supabase
        .from('share_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;

      if (!shareEvents || shareEvents.length === 0) {
        setShareMetrics({
          totalShares: 0,
          totalUsers: 0,
          topRepositories: [],
          topChartTypes: [],
          sharesByAction: [],
          recentShares: []
        });
        return;
      }

      // Calculate metrics
      const totalShares = shareEvents.length;
      const uniqueUsers = new Set(shareEvents.filter(e => e.user_id).map(e => e.user_id));
      const totalUsers = uniqueUsers.size;

      // Top repositories
      const repoShares = shareEvents.reduce((acc, event) => {
        if (event.repository) {
          acc[event.repository] = (acc[event.repository] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topRepositories = Object.entries(repoShares)
        .map(([repository, shares]) => ({
          repository,
          shares: shares as number,
          users: new Set(shareEvents.filter(e => e.repository === repository && e.user_id).map(e => e.user_id)).size
        }))
        .sort((a, b) => (b.shares as number) - (a.shares as number))
        .slice(0, 10);

      // Top chart types
      const chartTypeShares = shareEvents.reduce((acc, event) => {
        acc[event.chart_type] = (acc[event.chart_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topChartTypes = Object.entries(chartTypeShares)
        .map(([chart_type, shares]) => ({ chart_type, shares: shares as number }))
        .sort((a, b) => (b.shares as number) - (a.shares as number));

      // Shares by action
      const actionShares = shareEvents.reduce((acc, event) => {
        acc[event.action] = (acc[event.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sharesByAction = Object.entries(actionShares)
        .map(([action, shares]) => ({ action, shares: shares as number }))
        .sort((a, b) => (b.shares as number) - (a.shares as number));

      setShareMetrics({
        totalShares,
        totalUsers,
        topRepositories,
        topChartTypes,
        sharesByAction,
        recentShares: shareEvents.slice(0, 20)
      });

    } catch (err) {
      console.error('Failed to fetch share metrics:', err);
      throw err;
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSystemMetrics(),
        fetchShareMetrics()
      ]);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Card className="p-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchAnalytics} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Admin Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">
              Comprehensive analytics and system metrics
            </p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sharing">Sharing Analytics</TabsTrigger>
            <TabsTrigger value="referrals">Referral Traffic</TabsTrigger>
            <TabsTrigger value="citations">LLM Citations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* System Overview Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics?.totalRepositories || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Active repositories tracked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contributors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics?.totalContributors || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Active non-bot contributors
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pull Requests</CardTitle>
                  <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics?.totalPullRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Total pull requests tracked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics?.activeUsersLast30Days || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Users active in last 30 days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity (30 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemMetrics?.recentActivity.map((activity) => (
                      <div key={activity.type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {activity.type}
                          </Badge>
                        </div>
                        <span className="text-sm font-bold">{activity.count}</span>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No recent activity</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    System Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Most Active Repository:</span>
                      <span className="text-sm font-mono text-right">
                        {systemMetrics?.mostActiveRepo || 'No data'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Reviews:</span>
                      <span className="text-sm font-bold">{systemMetrics?.totalReviews || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Comments:</span>
                      <span className="text-sm font-bold">{systemMetrics?.totalComments || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sharing" className="space-y-6">
            {/* Share Metrics Overview Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{shareMetrics?.totalShares || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    All time sharing events
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sharing Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{shareMetrics?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Unique users sharing content
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Repository</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold truncate">
                    {shareMetrics?.topRepositories[0]?.repository || 'No data'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shareMetrics?.topRepositories[0]?.shares || 0} shares
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Most Shared Chart</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {shareMetrics?.topChartTypes[0]?.chart_type || 'No data'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shareMetrics?.topChartTypes[0]?.shares || 0} shares
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Top Repositories */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Top Repositories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {shareMetrics?.topRepositories.slice(0, 8).map((repo, index) => (
                      <div key={repo.repository} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm truncate max-w-32">{repo.repository}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{repo.shares} shares</span>
                          <span>•</span>
                          <span>{repo.users} users</span>
                        </div>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No data available</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Chart Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Chart Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {shareMetrics?.topChartTypes.map((chart, index) => (
                      <div key={chart.chart_type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm">{chart.chart_type}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{chart.shares}</span>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No data available</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Share Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Share Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {shareMetrics?.sharesByAction.map((action, index) => (
                      <div key={action.action} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm capitalize">{action.action}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{action.shares}</span>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No data available</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-6">
            <Card className="p-8 text-center">
              <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Referral Traffic Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Track referrer domains, landing page performance, traffic trends, and session metrics.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Will require referral_traffic table to be implemented.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="citations" className="space-y-6">
            <Card className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">LLM Citation Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Track LLM/AI citations, confidence scores, platform breakdown, and repository citation rates.
              </p>
              <Badge variant="outline">Coming Soon</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Will require citation_metrics and daily_citation_summary tables to be implemented.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}