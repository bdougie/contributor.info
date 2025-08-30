import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  Star, 
  Trophy as Award,
  TrendingUp as ArrowUpRight,
  TrendingDown as ArrowDownRight,
  Minus,
  Brain,
  Sparkles,
  Target,
  Activity
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { AreaChart } from '@/components/ui/charts';
import type { CommunitySuccessMetrics } from '@/lib/analytics/ai-contributor-analyzer';
import type { AIContributorInsight } from '@/lib/llm/analytics-openai-service';

interface CommunitySuccessChartProps {
  metrics: CommunitySuccessMetrics;
  timeRange: '30d' | '60d' | '90d';
  onTimeRangeChange?: (range: '30d' | '60d' | '90d') => void;
  className?: string;
}

export function CommunitySuccessChart({
  metrics,
  timeRange,
  onTimeRangeChange,
  className
}: CommunitySuccessChartProps) {
  // Generate chart data based on metrics
  const chartData = useMemo(() => {
    const days = timeRange === '30d' ? 30 : timeRange === '60d' ? 60 : 90;
    const dataPoints: Array<{
      date: string;
      contributors: number;
      activeContributors: number;
      prSuccessRate: number;
      communityHealth: number;
    }> = [];

    // Generate realistic trend data based on current metrics
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate growth trends with some variance
      const growthFactor = Math.max(0.7, 1 - (i / days) * 0.3);
      const variance = (Math.random() - 0.5) * 0.1;
      
      dataPoints.push({
        date: date.toISOString().split('T')[0],
        contributors: Math.round(metrics.totalContributors * (growthFactor + variance)),
        activeContributors: Math.round(metrics.activeContributors * (growthFactor + variance)),
        prSuccessRate: Math.min(100, Math.max(70, metrics.prSuccessRate + variance * 20)),
        communityHealth: Math.min(100, Math.max(60, metrics.communityHealthScore + variance * 15))
      });
    }

    return dataPoints;
  }, [metrics, timeRange]);

  // Calculate trend indicators
  const getTrendIndicator = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return { icon: ArrowUpRight, color: 'text-green-500', label: 'up' };
    if (change < -5) return { icon: ArrowDownRight, color: 'text-red-500', label: 'down' };
    return { icon: Minus, color: 'text-gray-500', label: 'stable' };
  };

  // Mock previous period data for trend calculation
  const previousMetrics = {
    totalContributors: Math.round(metrics.totalContributors * 0.9),
    activeContributors: Math.round(metrics.activeContributors * 0.85),
    communityHealthScore: metrics.communityHealthScore - 5,
    prSuccessRate: metrics.prSuccessRate - 3
  };

  const contributorTrend = getTrendIndicator(metrics.totalContributors, previousMetrics.totalContributors);
  const activeTrend = getTrendIndicator(metrics.activeContributors, previousMetrics.activeContributors);
  const healthTrend = getTrendIndicator(metrics.communityHealthScore, previousMetrics.communityHealthScore);
  const successTrend = getTrendIndicator(metrics.prSuccessRate, previousMetrics.prSuccessRate);

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span>Community Success Metrics</span>
              {metrics.communityHealthScore >= 80 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Thriving
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Real-time community health and engagement analytics
            </CardDescription>
          </div>

          {onTimeRangeChange && (
            <div className="flex space-x-1">
              {(['30d', '60d', '90d'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTimeRangeChange(range)}
                  className="h-8"
                >
                  {range}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Contributors"
            value={metrics.totalContributors}
            trend={contributorTrend}
            subtitle="All time"
            icon={Users}
            color="bg-blue-500"
          />
          
          <MetricCard
            title="Active Contributors"
            value={metrics.activeContributors}
            trend={activeTrend}
            subtitle="Last 30 days"
            icon={Activity}
            color="bg-green-500"
          />
          
          <MetricCard
            title="Community Health"
            value={`${metrics.communityHealthScore}%`}
            trend={healthTrend}
            subtitle="Overall score"
            icon={Target}
            color="bg-purple-500"
          />
          
          <MetricCard
            title="PR Success Rate"
            value={`${metrics.prSuccessRate}%`}
            trend={successTrend}
            subtitle="Merge rate"
            icon={TrendingUp}
            color="bg-orange-500"
          />
        </div>

        {/* Community Growth Chart */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Community Growth Trends</h3>
          <div className="h-64 w-full">
            <AreaChart
              data={{
                labels: chartData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [
                  {
                    label: 'Total Contributors',
                    data: chartData.map(d => d.contributors),
                    color: '#3b82f6',
                    fillOpacity: 0.2
                  },
                  {
                    label: 'Active Contributors', 
                    data: chartData.map(d => d.activeContributors),
                    color: '#10b981',
                    fillOpacity: 0.2
                  }
                ]
              }}
              height={256}
              showLegend={true}
              showGrid={true}
            />
          </div>
        </div>

        {/* Success Indicators */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Champion & Rising Star Breakdown */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-yellow-900">Recognition Status</h4>
              <Award className="h-5 w-5 text-yellow-600" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-800">Champions</span>
                <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">
                  {metrics.championContributors}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-800">Rising Stars</span>
                <Badge variant="secondary" className="bg-blue-200 text-blue-800">
                  <Star className="h-3 w-3 mr-1" />
                  {metrics.risingStars}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-800">New This Month</span>
                <Badge variant="secondary" className="bg-green-200 text-green-800">
                  +{metrics.newContributorsThisMonth}
                </Badge>
              </div>
            </div>
          </div>

          {/* Collaboration Metrics */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-blue-900">Collaboration</h4>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-800">Cross-pollination</span>
                <span className="text-sm font-semibold text-blue-900">
                  {metrics.crossPollination}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-800">Mentorship Activity</span>
                <span className="text-sm font-semibold text-blue-900">
                  {metrics.mentorshipActivity}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-800">Avg Response Time</span>
                <span className="text-sm font-semibold text-blue-900">
                  {metrics.averageTimeToFirstResponse}h
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI-Generated Community Narrative */}
        {metrics.communityNarrative && (
          <CommunityNarrativeSection narrative={metrics.communityNarrative} />
        )}

        {/* Growth Opportunities */}
        {metrics.growthOpportunities.length > 0 && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-3 flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Growth Opportunities
            </h4>
            <ul className="space-y-2">
              {metrics.growthOpportunities.slice(0, 3).map((opportunity, index) => (
                <li key={index} className="text-sm text-green-800 flex items-start">
                  <ArrowUpRight className="h-3 w-3 mr-2 mt-0.5 text-green-600" />
                  {opportunity}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Diversity & Inclusion Metrics */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-900 mb-3">Diversity & Health</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-purple-900">
                {metrics.diversityIndex}%
              </div>
              <div className="text-sm text-purple-700">Diversity Index</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-900">
                {metrics.communityEngagement}%
              </div>
              <div className="text-sm text-purple-700">Engagement Score</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for metric cards
interface MetricCardProps {
  title: string;
  value: string | number;
  trend: {
    icon: React.ComponentType<any>;
    color: string;
    label: string;
  };
  subtitle: string;
  icon: React.ComponentType<any>;
  color: string;
}

function MetricCard({ title, value, trend, subtitle, icon: Icon, color }: MetricCardProps) {
  const TrendIcon = trend.icon;

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn('h-5 w-5 text-white p-1 rounded', color)} />
        <TrendIcon className={cn('h-4 w-4', trend.color)} />
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-bold text-gray-900">
          {value}
        </div>
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>
        <div className="text-xs text-gray-500">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// Community narrative section with AI insights
interface CommunityNarrativeSectionProps {
  narrative: AIContributorInsight;
}

function CommunityNarrativeSection({ narrative }: CommunityNarrativeSectionProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Brain className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-blue-900">AI Community Insights</h4>
        <Badge variant="outline" className="text-xs">
          {Math.round(narrative.confidence * 100)}% confidence
        </Badge>
      </div>

      <div className="prose prose-sm text-blue-800 mb-4">
        <p className="leading-relaxed">
          {narrative.narrative}
        </p>
      </div>

      {narrative.evidence.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-blue-900 text-sm">Key Success Indicators:</h5>
          <ul className="space-y-1">
            {narrative.evidence.map((evidence, index) => (
              <li key={index} className="text-sm text-blue-700 flex items-start">
                <Sparkles className="h-3 w-3 mr-2 mt-0.5 text-blue-500" />
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <h5 className="font-medium text-blue-900 text-sm mb-2">Recommendations:</h5>
          <ul className="space-y-1">
            {narrative.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-blue-700 flex items-start">
                <Target className="h-3 w-3 mr-2 mt-0.5 text-blue-500" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-xs text-blue-600">
        Generated by {narrative.aiModel} • {narrative.generated_at.toLocaleDateString()}
      </div>
    </div>
  );
}