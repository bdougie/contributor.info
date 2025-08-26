import { useState, useEffect } from 'react'
import { TrendingDown, TrendingUp, Users, AlertTriangle, BarChart3, RefreshCw, Search, Filter } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { ConfidenceScoreBreakdown } from './confidence-score-breakdown';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConfidenceStats {
  total_repositories: number;
  total_contributors: number;
  avg_confidence_score: number;
  low_confidence_repos: number;
  score_distribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  worst_performing_repos: {
    repository_owner: string;
    repository_name: string;
    avg_confidence: number;
    contributor_count: number;
    last_updated: string;
  }[];
}

interface RepositoryConfidenceData {
  repository_owner: string;
  repository_name: string;
  contributor_count: number;
  avg_confidence_score: number;
  maintainer_count: number;
  external_contributor_count: number;
  self_selection_rate: number;
  last_analysis: string;
}

export function ConfidenceAnalyticsDashboard() {
  const [stats, setStats] = useState<ConfidenceStats | null>(null);
  const [repositories, setRepositories] = useState<RepositoryConfidenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Fetch confidence analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch overall confidence statistics
      const { data: confidenceData, error: confidenceError } = await supabase
        .rpc('get_confidence_analytics_summary_simple');

      if (confidenceError) throw confidenceError;

      // Fetch repository-level confidence data
      const { data: repoData, error: repoError } = await supabase
        .rpc('get_repository_confidence_summary_simple');

      if (repoError) throw repoError;

      setStats(confidenceData);
      setRepositories(repoData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      console.error('Error fetching confidence analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filter repositories based on search and confidence level
  const filteredRepositories = repositories.filter(repo => {
    const matchesSearch = 
      repo.repository_owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.repository_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const score = repo.avg_confidence_score || 0;
    const matchesFilter = 
      confidenceFilter === 'all' ||
      (confidenceFilter === 'low' && score <= 15) ||
      (confidenceFilter === 'medium' && score > 15 && score <= 35) ||
      (confidenceFilter === 'high' && score > 35);

    return matchesSearch && matchesFilter;
  });

  const getConfidenceBadgeVariant = (score: number) => {
    if (score <= 5) return 'destructive';
    if (score <= 15) return 'secondary';
    if (score <= 35) return 'default';
    return 'default';
  };

  const getConfidenceLabel = (score: number) => {
    if (score <= 5) return 'Critical';
    if (score <= 15) return 'Low';
    if (score <= 35) return 'Medium';
    return 'Good';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Confidence Analytics</h1>
            <p className="text-muted-foreground">Debug and analyze contributor confidence scores</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchAnalytics} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Confidence Analytics</h1>
          <p className="text-muted-foreground">Debug and analyze contributor confidence scores</p>
        </div>
        <Button onClick={fetchAnalytics} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_repositories || 0}</div>
              <p className="text-xs text-muted-foreground">with confidence data</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Contributors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_contributors || 0}</div>
              <p className="text-xs text-muted-foreground">analyzed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{stats?.avg_confidence_score?.toFixed(1) || '0.0'}%</div>
                {(stats?.avg_confidence_score || 0) < 15
? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )
: (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">across all repos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Low Confidence Repos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-red-600">{stats?.low_confidence_repos || 0}</div>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground">need attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Distribution */}
      {stats?.score_distribution && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Confidence Score Distribution
            </CardTitle>
            <CardDescription>
              How confidence scores are distributed across all repositories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.score_distribution.map((bucket) => (
                <div key={bucket.range} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium">{bucket.range}</div>
                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${bucket.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-16 text-right">
                    {bucket.count} repos
                  </div>
                  <div className="text-sm font-medium w-12 text-right">
                    {bucket.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repository List with Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Repository Confidence Scores
              </CardTitle>
              <CardDescription>
                Detailed confidence analysis for each repository
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={confidenceFilter} onValueChange={(value: unknown) => setConfidenceFilter(value)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low (&lt;15%)</SelectItem>
                  <SelectItem value="medium">Medium (15-35%)</SelectItem>
                  <SelectItem value="high">High (&gt;35%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredRepositories.map((repo) => (
              <div 
                key={`${repo.repository_owner}/${repo.repository_name}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedRepo(`${repo.repository_owner}/${repo.repository_name}`)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium">
                      {repo.repository_owner}/{repo.repository_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {repo.contributor_count} contributors • {repo.maintainer_count} maintainers
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Self-Selection Rate</div>
                    <div className="font-medium">
                      {repo.self_selection_rate > 0 ? `${repo.self_selection_rate.toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Confidence Score</div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{repo.avg_confidence_score?.toFixed(1) || '0.0'}%</span>
                      <Badge variant={getConfidenceBadgeVariant(repo.avg_confidence_score || 0)}>
                        {getConfidenceLabel(repo.avg_confidence_score || 0)}
                      </Badge>
                    </div>
                  </div>

                  <Button variant="outline" size="sm">
                    Analyze
                  </Button>
                </div>
              </div>
            ))}
            
            {filteredRepositories.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No repositories match your current filters
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed breakdown for selected repository */}
      {selectedRepo && (
        <ConfidenceScoreBreakdown 
          repositoryId={selectedRepo}
          onClose={() => setSelectedRepo(null)}
        />
      )}
    </div>
  );
}