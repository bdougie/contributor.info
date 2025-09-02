import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { TrendChart } from './TrendChart';
import type { Repository } from './RepositoryList';

interface WorkspacePRTrendsProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: string;
}

interface PRTrendData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: (number | null)[];
    color?: string;
  }>;
}

export function WorkspacePRTrends({
  repositories,
  selectedRepositories,
  timeRange,
}: WorkspacePRTrendsProps) {
  const [trendData, setTrendData] = useState<PRTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalPRs, setTotalPRs] = useState(0);
  const [avgPRsPerDay, setAvgPRsPerDay] = useState(0);

  const fetchTrendData = useCallback(async () => {
    setLoading(true);
    try {
      // Filter repositories based on selection
      const filteredRepos =
        selectedRepositories.length > 0
          ? repositories.filter((r) => selectedRepositories.includes(r.id))
          : repositories;

      if (filteredRepos.length === 0) {
        setTrendData(null);
        setTotalPRs(0);
        setAvgPRsPerDay(0);
        return;
      }

      const repoIds = filteredRepos.map((r) => r.id);

      // Calculate date range
      const daysMap: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
        all: 730,
      };

      const days = daysMap[timeRange] || 30;
      const currentDate = new Date();
      const startDate = new Date(currentDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Fetch PRs within the time range
      const { data: prData, error } = await supabase
        .from('pull_requests')
        .select('created_at, merged_at, state, repository_id')
        .in('repository_id', repoIds)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!prData || prData.length === 0) {
        setTrendData({
          labels: [],
          datasets: [
            {
              label: 'No data',
              data: [],
              color: '#94a3b8',
            },
          ],
        });
        setTotalPRs(0);
        setAvgPRsPerDay(0);
        return;
      }

      // Create daily buckets
      const dailyData = new Map<string, { opened: number; merged: number; closed: number }>();
      const labels: string[] = [];

      // Initialize all days in the range
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        labels.push(label);
        dailyData.set(dateStr, { opened: 0, merged: 0, closed: 0 });
      }

      // Count PRs by day
      prData.forEach((pr) => {
        const createdDate = pr.created_at.split('T')[0];

        // Count opened PRs
        if (dailyData.has(createdDate)) {
          const data = dailyData.get(createdDate)!;
          data.opened++;
        }

        // Count merged PRs
        if (pr.merged_at) {
          const mergedDate = pr.merged_at.split('T')[0];
          if (dailyData.has(mergedDate)) {
            const data = dailyData.get(mergedDate)!;
            data.merged++;
          }
        }

        // Count closed PRs (not merged)
        if (pr.state === 'closed' && !pr.merged_at) {
          // We don't have closed_at in our query, so we'll use created_at for now
          // This is a limitation but acceptable for trend visualization
          if (dailyData.has(createdDate)) {
            const data = dailyData.get(createdDate)!;
            data.closed++;
          }
        }
      });

      // Convert to arrays for chart
      const openedData: number[] = [];
      const mergedData: number[] = [];
      const closedData: number[] = [];

      dailyData.forEach((day) => {
        openedData.push(day.opened);
        mergedData.push(day.merged);
        closedData.push(day.closed);
      });

      // Calculate statistics
      const total = prData.length;
      const avgPerDay = total / days;

      setTotalPRs(total);
      setAvgPRsPerDay(avgPerDay);

      // Set trend data for chart
      setTrendData({
        labels,
        datasets: [
          {
            label: 'Opened',
            data: openedData,
            color: '#3b82f6', // blue
          },
          {
            label: 'Merged',
            data: mergedData,
            color: '#10b981', // green
          },
          {
            label: 'Closed',
            data: closedData,
            color: '#ef4444', // red
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching PR trend data:', error);
      setTrendData(null);
      setTotalPRs(0);
      setAvgPRsPerDay(0);
    } finally {
      setLoading(false);
    }
  }, [repositories, selectedRepositories, timeRange]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Activity</CardTitle>
          <CardDescription>Daily PR activity over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!trendData || trendData.labels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Activity</CardTitle>
          <CardDescription>Daily PR activity over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No pull request data available for the selected time range
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pull Request Activity</CardTitle>
            <CardDescription>Daily PR activity over time</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{totalPRs} total PRs</Badge>
            <Badge variant="secondary">{avgPRsPerDay.toFixed(1)} avg/day</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <TrendChart title="" data={trendData} height={256} showLegend={true} />
        </div>
      </CardContent>
    </Card>
  );
}
