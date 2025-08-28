import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  GitFork,
  GitPullRequest,
  AlertCircle,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  TrendingUp as LineChartIcon,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { RepositoryMetric } from './AnalyticsDashboard';

export interface RepositoryComparisonProps {
  repositories: RepositoryMetric[];
  loading?: boolean;
  maxRepositories?: number;
  className?: string;
}

type ComparisonMetric = 'stars' | 'forks' | 'pull_requests' | 'issues' | 'contributors' | 'activity_score';
type ChartType = 'bar' | 'line' | 'radar';

const METRIC_LABELS: Record<ComparisonMetric, string> = {
  stars: 'Stars',
  forks: 'Forks',
  pull_requests: 'Pull Requests',
  issues: 'Issues',
  contributors: 'Contributors',
  activity_score: 'Activity Score',
};

const METRIC_ICONS: Record<ComparisonMetric, React.ComponentType<{ className?: string }>> = {
  stars: Star,
  forks: GitFork,
  pull_requests: GitPullRequest,
  issues: AlertCircle,
  contributors: Users,
  activity_score: Activity,
};

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
];

export function RepositoryComparison({
  repositories,
  loading = false,
  maxRepositories = 5,
  className,
}: RepositoryComparisonProps) {
  const [selectedRepos, setSelectedRepos] = useState<string[]>(
    repositories.slice(0, Math.min(3, maxRepositories)).map((r) => r.id)
  );
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedMetric, setSelectedMetric] = useState<ComparisonMetric>('activity_score');

  // Filter repositories for comparison
  const comparisonRepos = useMemo(() => {
    return repositories.filter((r) => selectedRepos.includes(r.id));
  }, [repositories, selectedRepos]);

  // Prepare data for charts
  const chartData = useMemo(() => {
    if (chartType === 'radar') {
      // Radar chart needs all metrics for each repository
      const metrics: ComparisonMetric[] = ['stars', 'forks', 'pull_requests', 'issues', 'contributors', 'activity_score'];
      
      // Normalize values to 0-100 scale for radar chart
      const maxValues = metrics.reduce((acc, metric) => {
        acc[metric] = Math.max(...repositories.map(r => r[metric]));
        return acc;
      }, {} as Record<ComparisonMetric, number>);

      return metrics.map((metric) => ({
        metric: METRIC_LABELS[metric],
        ...comparisonRepos.reduce((acc, repo) => {
          const normalizedValue = maxValues[metric] > 0 
            ? (repo[metric] / maxValues[metric]) * 100 
            : 0;
          acc[repo.name] = Math.round(normalizedValue);
          return acc;
        }, {} as Record<string, number>),
      }));
    } else {
      // Bar and Line charts
      return comparisonRepos.map((repo) => ({
        name: repo.name,
        value: repo[selectedMetric],
        trend: repo.trend,
      }));
    }
  }, [repositories, comparisonRepos, chartType, selectedMetric]);

  const handleRepoToggle = (repoId: string) => {
    if (selectedRepos.includes(repoId)) {
      setSelectedRepos(selectedRepos.filter((id) => id !== repoId));
    } else if (selectedRepos.length < maxRepositories) {
      setSelectedRepos([...selectedRepos, repoId]);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading repository comparison...</div>
        </CardContent>
      </Card>
    );
  }

  if (repositories.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">No repositories to compare</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Repository Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Repositories to Compare</CardTitle>
          <CardDescription>
            Choose up to {maxRepositories} repositories for comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {repositories.map((repo, index) => (
              <Button
                key={repo.id}
                variant={selectedRepos.includes(repo.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRepoToggle(repo.id)}
                disabled={
                  !selectedRepos.includes(repo.id) && selectedRepos.length >= maxRepositories
                }
                className="gap-1"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                {repo.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Repository Metrics Comparison</CardTitle>
              <CardDescription>
                Visual comparison of selected repositories
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {chartType !== 'radar' && (
                <Select
                  value={selectedMetric}
                  onValueChange={(value) => setSelectedMetric(value as ComparisonMetric)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Tabs value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
                <TabsList>
                  <TabsTrigger value="bar">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      <span>Bar</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="line">
                    <div className="flex items-center gap-1">
                      <LineChartIcon className="h-4 w-4" />
                      <span>Line</span>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="radar">Radar</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {comparisonRepos.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Select repositories to compare
            </div>
          ) : (
            <>
              {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="#3b82f6"
                    name={METRIC_LABELS[selectedMetric]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name={METRIC_LABELS[selectedMetric]}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === 'radar' && (
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {comparisonRepos.map((repo, index) => (
                    <Radar
                      key={repo.id}
                      name={repo.name}
                      dataKey={repo.name}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      fillOpacity={0.3}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Repository</th>
                  {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const Icon = METRIC_ICONS[key as ComparisonMetric];
                    return (
                      <th key={key} className="text-center px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {comparisonRepos.map((repo, index) => (
                  <tr key={repo.id} className="border-b">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="font-medium">{repo.owner}/{repo.name}</span>
                      </div>
                    </td>
                    {Object.keys(METRIC_LABELS).map((metric) => {
                      const value = repo[metric as ComparisonMetric];
                      const trend = metric === 'activity_score' && repo.trend;
                      return (
                        <td key={metric} className="text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-medium">{value.toLocaleString()}</span>
                            {trend && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'ml-1 text-xs px-1 py-0',
                                  trend > 0
                                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                    : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                )}
                              >
                                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {Math.abs(trend)}%
                              </Badge>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}