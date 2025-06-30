import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  X, 
  Users, 
  Activity, 
  Clock, 
  Shield, 
  AlertTriangle,
  Info,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfidenceAlgorithmExplainer } from './confidence-algorithm-explainer';

interface ContributorConfidenceDetail {
  user_id: string;
  role: string;
  confidence_score: number;
  privileged_events: number;
  total_events: number;
  event_diversity: number;
  activity_recency_days: number;
  consistency_score: number;
  detection_methods: string[];
  last_active: string;
  component_scores: {
    privileged_events: number;
    activity_patterns: number;
    temporal_consistency: number;
  };
}

interface RepositoryConfidenceBreakdown {
  repository_owner: string;
  repository_name: string;
  overall_avg_confidence: number;
  contributor_breakdown: ContributorConfidenceDetail[];
  algorithm_weights: {
    privileged_events_weight: number;
    activity_patterns_weight: number;
    temporal_consistency_weight: number;
  };
  insights: {
    low_confidence_count: number;
    maintainer_count: number;
    external_contributor_count: number;
    common_issues: string[];
  };
}

interface ConfidenceScoreBreakdownProps {
  repositoryId: string; // format: "owner/repo"
  onClose: () => void;
}

export function ConfidenceScoreBreakdown({ repositoryId, onClose }: ConfidenceScoreBreakdownProps) {
  const [breakdown, setBreakdown] = useState<RepositoryConfidenceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);

  const [owner, repo] = repositoryId.split('/');

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .rpc('get_repository_confidence_breakdown', {
            p_repository_owner: owner,
            p_repository_name: repo
          });

        if (err) throw err;
        setBreakdown(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch breakdown');
        console.error('Error fetching confidence breakdown:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [owner, repo]);

  const getScoreColor = (score: number) => {
    if (score <= 5) return 'text-red-600';
    if (score <= 15) return 'text-orange-600';
    if (score <= 35) return 'text-blue-600';
    return 'text-green-600';
  };

  const getScoreBg = (score: number) => {
    if (score <= 5) return 'bg-red-50 border-red-200';
    if (score <= 15) return 'bg-orange-50 border-orange-200';
    if (score <= 35) return 'bg-blue-50 border-blue-200';
    return 'bg-green-50 border-green-200';
  };

  const formatLastActive = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-8 w-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !breakdown) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-red-600">Error Loading Breakdown</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Confidence Breakdown: {repositoryId}
            </CardTitle>
            <CardDescription>
              Detailed analysis of contributor confidence scores and algorithm components
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExplainer(!showExplainer)}
            >
              <Info className="h-4 w-4 mr-2" />
              How it works
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Algorithm Explainer */}
        {showExplainer && (
          <ConfidenceAlgorithmExplainer 
            weights={breakdown.algorithm_weights}
            onClose={() => setShowExplainer(false)}
          />
        )}

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={getScoreBg(breakdown.overall_avg_confidence)}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{breakdown.overall_avg_confidence.toFixed(1)}%</div>
              <p className="text-sm text-muted-foreground">Overall Avg</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{breakdown.insights.low_confidence_count}</div>
              <p className="text-sm text-muted-foreground">Low Confidence</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{breakdown.insights.maintainer_count}</div>
              <p className="text-sm text-muted-foreground">Maintainers</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{breakdown.insights.external_contributor_count}</div>
              <p className="text-sm text-muted-foreground">External Contributors</p>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Component Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Algorithm Component Performance</CardTitle>
            <CardDescription>
              How each component of the confidence algorithm is performing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Privileged Events */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Privileged Events</span>
                    <Badge variant="secondary">{breakdown.algorithm_weights.privileged_events_weight * 100}%</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Avg: {(breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.privileged_events, 0) / breakdown.contributor_breakdown.length * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.privileged_events, 0) / breakdown.contributor_breakdown.length * 100}
                  className="h-2"
                />
              </div>

              {/* Activity Patterns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="font-medium">Activity Patterns</span>
                    <Badge variant="secondary">{breakdown.algorithm_weights.activity_patterns_weight * 100}%</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Avg: {(breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.activity_patterns, 0) / breakdown.contributor_breakdown.length * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.activity_patterns, 0) / breakdown.contributor_breakdown.length * 100}
                  className="h-2"
                />
              </div>

              {/* Temporal Consistency */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Temporal Consistency</span>
                    <Badge variant="secondary">{breakdown.algorithm_weights.temporal_consistency_weight * 100}%</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Avg: {(breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.temporal_consistency, 0) / breakdown.contributor_breakdown.length * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={breakdown.contributor_breakdown.reduce((sum, c) => sum + c.component_scores.temporal_consistency, 0) / breakdown.contributor_breakdown.length * 100}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Common Issues */}
        {breakdown.insights.common_issues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Common Issues Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {breakdown.insights.common_issues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2" />
                    <span className="text-sm">{issue}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Individual Contributor Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Individual Contributor Analysis
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {breakdown.contributor_breakdown.length} contributors
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {breakdown.contributor_breakdown
                .sort((a, b) => b.confidence_score - a.confidence_score)
                .map((contributor) => (
                <div 
                  key={contributor.user_id}
                  className={`p-4 border rounded-lg ${getScoreBg(contributor.confidence_score * 100)} cursor-pointer hover:shadow-sm transition-shadow`}
                  onClick={() => setSelectedContributor(
                    selectedContributor === contributor.user_id ? null : contributor.user_id
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{contributor.user_id}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {contributor.role}
                          </Badge>
                          <span>{contributor.total_events} events</span>
                          <span>{formatLastActive(contributor.last_active)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getScoreColor(contributor.confidence_score * 100)}`}>
                          {(contributor.confidence_score * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contributor.privileged_events} privileged
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedContributor === contributor.user_id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Privileged Events</div>
                          <div className="text-lg">{(contributor.component_scores.privileged_events * 100).toFixed(1)}%</div>
                          <Progress value={contributor.component_scores.privileged_events * 100} className="h-1 mt-1" />
                        </div>
                        <div>
                          <div className="font-medium">Activity Patterns</div>
                          <div className="text-lg">{(contributor.component_scores.activity_patterns * 100).toFixed(1)}%</div>
                          <Progress value={contributor.component_scores.activity_patterns * 100} className="h-1 mt-1" />
                        </div>
                        <div>
                          <div className="font-medium">Temporal Consistency</div>
                          <div className="text-lg">{(contributor.component_scores.temporal_consistency * 100).toFixed(1)}%</div>
                          <Progress value={contributor.component_scores.temporal_consistency * 100} className="h-1 mt-1" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Event Diversity</div>
                          <div>{contributor.event_diversity} types</div>
                        </div>
                        <div>
                          <div className="font-medium">Consistency Score</div>
                          <div>{(contributor.consistency_score * 100).toFixed(1)}%</div>
                        </div>
                      </div>

                      {contributor.detection_methods.length > 0 && (
                        <div>
                          <div className="font-medium text-sm mb-2">Detection Methods</div>
                          <div className="flex flex-wrap gap-1">
                            {contributor.detection_methods.map((method, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}