import { useMemo } from 'react';
import { Heart, TrendingUp, TrendingDown, Minus } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { HealthMetrics } from '@/lib/insights/health-metrics';
import type { RepoStats, PullRequest } from '@/lib/types';

interface RepositoryHealthCoreProps {
  stats: RepoStats;
  timeRange: string;
}

// Calculate health metrics from cached stats data
function calculateHealthMetricsFromStats(stats: RepoStats, timeRange: string): HealthMetrics {
  const now = new Date();
  const pullRequests = stats.pullRequests;

  // Calculate various health factors
  const factors: HealthMetrics['factors'] = [];
  const recommendations: string[] = [];

  // 1. PR Merge Time Factor
  const mergedPRs = pullRequests.filter((pr: PullRequest) => pr.merged_at);
  let avgMergeTime = 0;

  if (mergedPRs.length > 0) {
    const mergeTimes = mergedPRs.map((pr: PullRequest) => {
      const created = new Date(pr.created_at);
      const merged = new Date(pr.merged_at!);
      return (merged.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    });
    avgMergeTime = mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length;
  }

  let mergeTimeScore = 100;
  let mergeTimeStatus: 'good' | 'warning' | 'critical' = 'good';

  if (avgMergeTime <= 24) {
    mergeTimeScore = 100;
    mergeTimeStatus = 'good';
  } else if (avgMergeTime <= 72) {
    mergeTimeScore = 80;
    mergeTimeStatus = 'warning';
    recommendations.push('Consider reviewing PRs more frequently to reduce merge times');
  } else {
    mergeTimeScore = 50;
    mergeTimeStatus = 'critical';
    recommendations.push('PRs are taking too long to merge - consider improving review processes');
  }

  factors.push({
    name: 'PR Merge Time',
    score: mergeTimeScore,
    weight: 25,
    status: mergeTimeStatus,
    description: `Average merge time: ${avgMergeTime.toFixed(1)} hours`,
  });

  // 2. Contributor Diversity Factor
  const uniqueContributors = new Set(pullRequests.map((pr: PullRequest) => pr.user.login)).size;
  const totalPRs = pullRequests.length;

  let diversityScore = 100;
  let diversityStatus: 'good' | 'warning' | 'critical' = 'good';

  if (uniqueContributors >= 10) {
    diversityScore = 100;
    diversityStatus = 'good';
  } else if (uniqueContributors >= 5) {
    diversityScore = 75;
    diversityStatus = 'warning';
    recommendations.push('Consider encouraging more contributors to improve bus factor');
  } else {
    diversityScore = 40;
    diversityStatus = 'critical';
    recommendations.push('Very few contributors - high risk if key contributors leave');
  }

  factors.push({
    name: 'Contributor Diversity',
    score: diversityScore,
    weight: 20,
    status: diversityStatus,
    description: `${uniqueContributors} unique contributors`,
  });

  // 3. Review Coverage Factor
  const reviewedPRs = pullRequests.filter(
    (pr: PullRequest) => (pr.requested_reviewers && pr.requested_reviewers.length > 0) || (pr.reviews && pr.reviews.length > 0)
  );
  const reviewCoverage = totalPRs > 0 ? (reviewedPRs.length / totalPRs) * 100 : 0;

  const reviewScore = Math.max(0, reviewCoverage);
  let reviewStatus: 'good' | 'warning' | 'critical' = 'good';

  if (reviewCoverage >= 80) {
    reviewStatus = 'good';
  } else if (reviewCoverage >= 50) {
    reviewStatus = 'warning';
    recommendations.push('Consider requiring reviews for more PRs');
  } else {
    reviewStatus = 'critical';
    recommendations.push('Most PRs lack proper review - implement review requirements');
  }

  factors.push({
    name: 'Review Coverage',
    score: reviewScore,
    weight: 20,
    status: reviewStatus,
    description: `${reviewCoverage.toFixed(0)}% of PRs reviewed`,
  });

  // 4. Activity Level Factor
  const timeRangeNum = parseInt(timeRange) || 30;
  const dailyActivity = totalPRs / timeRangeNum;

  const activityScore = Math.min(100, dailyActivity * 20); // Scale based on activity
  let activityStatus: 'good' | 'warning' | 'critical' = 'good';

  if (dailyActivity >= 2) {
    activityStatus = 'good';
  } else if (dailyActivity >= 0.5) {
    activityStatus = 'warning';
  } else {
    activityStatus = 'critical';
    recommendations.push('Repository activity is very low');
  }

  factors.push({
    name: 'Activity Level',
    score: activityScore,
    weight: 20,
    status: activityStatus,
    description: `${dailyActivity.toFixed(1)} PRs per day average`,
  });

  // 5. Response Time Factor
  const responseTimes = pullRequests
    .filter((pr: PullRequest) => pr.comments && pr.comments.length > 0)
    .map((pr: PullRequest) => {
      // Estimate response time (simplified)
      const created = new Date(pr.created_at);
      const updated = new Date(pr.updated_at);
      return (updated.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    });

  const avgResponseTime =
    responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

  let responseScore = 100;
  let responseStatus: 'good' | 'warning' | 'critical' = 'good';

  if (avgResponseTime <= 4) {
    responseScore = 100;
    responseStatus = 'good';
  } else if (avgResponseTime <= 24) {
    responseScore = 75;
    responseStatus = 'warning';
  } else {
    responseScore = 40;
    responseStatus = 'critical';
    recommendations.push('PRs are getting slow responses - consider improving communication');
  }

  factors.push({
    name: 'Response Time',
    score: responseScore,
    weight: 15,
    status: responseStatus,
    description: `${avgResponseTime.toFixed(1)} hours average response`,
  });

  // Calculate weighted overall score
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const weightedScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const overallScore = Math.round(weightedScore / totalWeight);

  // Determine trend (simplified - could be enhanced with historical data)
  let trend: HealthMetrics['trend'] = 'stable';
  if (overallScore >= 80) trend = 'improving';
  else if (overallScore < 60) trend = 'declining';

  return {
    score: overallScore,
    trend,
    lastChecked: now,
    factors,
    recommendations: recommendations.slice(0, 3), // Limit to top 3 recommendations
  };
}

export function RepositoryHealthCore({ stats, timeRange }: RepositoryHealthCoreProps) {
  const health = useMemo(() => {
    if (stats.loading || stats.error || stats.pullRequests.length === 0) {
      return null;
    }
    return calculateHealthMetricsFromStats(stats, timeRange);
  }, [stats, timeRange]);

  const loading = stats.loading;

  const getTrendIcon = (trend: HealthMetrics['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-2">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Health data unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Overall Health</h4>
          <div className="flex items-center gap-2">
            {getTrendIcon(health.trend)}
            <span className="text-xs text-muted-foreground capitalize">{health.trend}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <span className={cn('text-4xl font-bold', getScoreColor(health.score))}>
              {health.score}
            </span>
            <span className="text-lg text-muted-foreground mb-1">/100</span>
          </div>

          <Progress value={health.score} className="h-3" />

          <p className="text-xs text-muted-foreground">
            Last updated {new Date(health.lastChecked).toLocaleTimeString()}
          </p>
        </div>
      </Card>

      {/* Health Factors */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Health Factors</h4>
        <div className="space-y-3">
          {health.factors.map((factor) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', getStatusColor(factor.status))} />
                  <span className="text-sm">{factor.name}</span>
                </div>
                <span className={cn('text-sm font-medium', getScoreColor(factor.score))}>
                  {factor.score}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-4">{factor.description}</p>
              <Progress value={factor.score} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
