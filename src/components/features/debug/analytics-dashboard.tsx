import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Share2, 
  TrendingUp, 
  Users, 
  ExternalLink,
  RefreshCw,
  Calendar,
  Globe
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

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

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<ShareMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch recent share events
      const { data: shareEvents, error: eventsError } = await supabase
        .from('share_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;

      if (!shareEvents || shareEvents.length === 0) {
        setMetrics({
          totalShares: 0,
          totalUsers: 0,
          topRepositories: [],
          topChartTypes: [],
          sharesByAction: [],
          recentShares: []
        });
        setLoading(false);
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

      setMetrics({
        totalShares,
        totalUsers,
        topRepositories,
        topChartTypes,
        sharesByAction,
        recentShares: shareEvents.slice(0, 20)
      });

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
              Share Analytics
            </h1>
            <p className="text-muted-foreground">
              Track social sharing metrics and user engagement
            </p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalShares || 0}</div>
              <p className="text-xs text-muted-foreground">
                All time sharing events
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
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
                {metrics?.topRepositories[0]?.repository || 'No data'}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics?.topRepositories[0]?.shares || 0} shares
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Shared</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {metrics?.topChartTypes[0]?.chart_type || 'No data'}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics?.topChartTypes[0]?.shares || 0} shares
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
                {metrics?.topRepositories.slice(0, 8).map((repo, index) => (
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
                {metrics?.topChartTypes.map((chart, index) => (
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
                {metrics?.sharesByAction.map((action, index) => (
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

        {/* Recent Shares */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Shares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics?.recentShares.slice(0, 10).map((share) => (
                <div key={share.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {share.chart_type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {share.action}
                      </Badge>
                      {share.repository && (
                        <span className="text-sm font-medium truncate">
                          {share.repository}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(share.created_at), { addSuffix: true })} 
                      {share.share_type && ` • ${share.share_type}`}
                      {share.domain && ` • ${share.domain}`}
                    </p>
                  </div>
                  {share.short_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(share.short_url!, '_blank')}
                      className="ml-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )) || <p className="text-sm text-muted-foreground">No recent shares</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}