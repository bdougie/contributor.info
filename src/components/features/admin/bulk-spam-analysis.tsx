import { useState, useEffect } from 'react'
import { Shield, Search, RefreshCw, Play, CheckCircle, AlertTriangle, BarChart3 } from '@/components/ui/icon';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { logAdminAction, useAdminGitHubId } from '@/hooks/use-admin-auth';

interface RepositoryStats {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  total_prs: number;
  analyzed_prs: number;
  pending_prs: number;
  spam_prs: number;
  analysis_progress: number;
  last_analyzed_at?: string;
  avg_spam_score?: number;
}

interface BulkAnalysisJob {
  repository_id: string;
  repository_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  processed: number;
  total: number;
  errors: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export function BulkSpamAnalysis() {
  const [repositories, setRepositories] = useState<RepositoryStats[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<RepositoryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'analyzed' | 'partial'>('all');
  const [bulkJobs, setBulkJobs] = useState<BulkAnalysisJob[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [systemProgress, setSystemProgress] = useState(0);
  const adminGitHubId = useAdminGitHubId();
  const { toast } = useToast();

  useEffect(() => {
    fetchRepositoryStats();
  }, []);

  useEffect(() => {
    filterRepositories();
  }, [repositories, searchTerm, filterStatus]);

  const fetchRepositoryStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get repository stats with PR analysis data
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .select(`
          id,
          owner,
          name,
          full_name,
          pull_requests (
            id,
            spam_score,
            is_spam,
            spam_detected_at
          )
        `)
        .order('full_name');

      if (repoError) {
        throw repoError;
      }

      if (!repoData) {
        setRepositories([]);
        return;
      }

      // Calculate stats for each repository
      const stats: RepositoryStats[] = repoData.map(repo => {
        const totalPrs = repo.pull_requests?.length || 0;
        const analyzedPrs = repo.pull_requests?.filter(pr => pr.spam_score !== null).length || 0;
        const pendingPrs = totalPrs - analyzedPrs;
        const spamPrs = repo.pull_requests?.filter(pr => pr.is_spam).length || 0;
        const analysisProgress = totalPrs > 0 ? (analyzedPrs / totalPrs) * 100 : 0;
        
        // Calculate average spam score for analyzed PRs
        const analyzedPRsWithScores = repo.pull_requests?.filter(pr => pr.spam_score !== null) || [];
        const avgSpamScore = analyzedPRsWithScores.length > 0 
          ? analyzedPRsWithScores.reduce((sum, pr) => sum + (pr.spam_score || 0), 0) / analyzedPRsWithScores.length
          : undefined;

        // Find most recent analysis date
        const lastAnalyzedAt = repo.pull_requests
          ?.filter(pr => pr.spam_detected_at)
          ?.sort((a, b) => new Date(b.spam_detected_at!).getTime() - new Date(a.spam_detected_at!).getTime())[0]
          ?.spam_detected_at;

        return {
          id: repo.id,
          owner: repo.owner,
          name: repo.name,
          full_name: repo.full_name,
          total_prs: totalPrs,
          analyzed_prs: analyzedPrs,
          pending_prs: pendingPrs,
          spam_prs: spamPrs,
          analysis_progress: Math.round(analysisProgress),
          last_analyzed_at: lastAnalyzedAt,
          avg_spam_score: avgSpamScore ? Math.round(avgSpamScore) : undefined
        };
      });

      setRepositories(stats);
    } catch (err) {
      console.error('Error fetching repository stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch repository statistics');
    } finally {
      setLoading(false);
    }
  };

  const filterRepositories = () => {
    const filtered = repositories.filter(repo => {
      const matchesSearch = 
        repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        filterStatus === 'all' ||
        (filterStatus === 'pending' && repo.pending_prs > 0) ||
        (filterStatus === 'analyzed' && repo.analysis_progress === 100) ||
        (filterStatus === 'partial' && repo.analysis_progress > 0 && repo.analysis_progress < 100);

      return matchesSearch && matchesStatus;
    });

    // Sort by pending PRs descending (most work first)
    filtered.sort((a, b) => b.pending_prs - a.pending_prs);
    setFilteredRepos(filtered);
  };

  const analyzeRepository = async (repositoryId: string, repositoryName: string, forceRecheck = false) => {
    if (!adminGitHubId) {
      toast({
        title: "Authentication required",
        description: "Admin authentication required to run analysis",
        variant: "destructive"
      });
      return;
    }

    try {
      // Add job to tracking
      const newJob: BulkAnalysisJob = {
        repository_id: repositoryId,
        repository_name: repositoryName,
        status: 'running',
        processed: 0,
        total: 0,
        errors: 0,
        started_at: new Date().toISOString()
      };
      setBulkJobs(prev => [...prev, newJob]);

      // Call spam detection function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spam-detection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repository_id: repositoryId,
          limit: 1000, // Process up to 1000 PRs per repository
          force_recheck: forceRecheck
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} ${_errorText}`);
      }

      const result = await response.json();

      // Update job status
      setBulkJobs(prev => prev.map(job => 
        job.repository_id === repositoryId 
          ? {
              ...job,
              status: 'completed',
              processed: result.processed || 0,
              errors: result.errors || 0,
              completed_at: new Date().toISOString()
            }
          : job
      ));

      // Log admin action
      await logAdminAction(
        adminGitHubId,
        'bulk_spam_analysis',
        'repository',
        repositoryId,
        {
          repository_name: repositoryName,
          processed: result.processed,
          errors: result.errors,
          stats: result.stats,
          force_recheck: forceRecheck
        }
      );

      toast({
        title: "Analysis completed",
        description: `${repositoryName}: Analyzed ${result.processed} PRs, ${result.errors} errors`,
        variant: "default"
      });

      // Refresh repository stats
      await fetchRepositoryStats();

    } catch (err) {
      console.error('Error analyzing repository:', err);
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';

      // Update job status to failed
      setBulkJobs(prev => prev.map(job => 
        job.repository_id === repositoryId 
          ? {
              ...job,
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString()
            }
          : job
      ));

      toast({
        title: "Analysis failed",
        description: `${repositoryName}: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const analyzeAllRepositories = async () => {
    if (!adminGitHubId) {
      toast({
        title: "Authentication required",
        description: "Admin authentication required to run bulk analysis",
        variant: "destructive"
      });
      return;
    }

    if (systemStats.pendingPrs === 0) {
      toast({
        title: "No PRs to analyze",
        description: "All PRs are already analyzed",
        variant: "default"
      });
      return;
    }

    setIsAnalyzing(true);
    setSystemProgress(0);

    try {
      // Use the new analyze_all endpoint
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spam-detection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          analyze_all: true,
          limit: 1000, // Process up to 1000 PRs per repository
          force_recheck: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bulk analysis failed: ${response.status} ${_errorText}`);
      }

      const result = await response.json();

      // Log admin action
      await logAdminAction(
        adminGitHubId,
        'bulk_spam_analysis_all',
        'system',
        'all_repositories',
        {
          total_repositories: result.total_repositories,
          total_processed: result.total_processed,
          total_errors: result.total_errors,
          overall_stats: result.overall_stats
        }
      );

      // Update bulk jobs with detailed results
      if (result.results) {
        const newJobs: BulkAnalysisJob[] = result.results.map((repoResult: unknown) => ({
          repository_id: repoResult.repository_id,
          repository_name: repoResult.repository_name,
          status: repoResult.error ? 'failed' : 'completed',
          processed: repoResult.processed || 0,
          total: repoResult.processed || 0,
          errors: repoResult.errors || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: repoResult.error
        }));
        setBulkJobs(prev => [...prev, ...newJobs]);
      }

      toast({
        title: "Bulk analysis completed",
        description: `Analyzed ${result.total_repositories} repositories, processed ${result.total_processed} PRs, ${result.total_errors} errors`,
        variant: "default"
      });

      // Set progress to 100%
      setSystemProgress(100);

      // Refresh repository stats after a moment
      setTimeout(() => {
        fetchRepositoryStats();
      }, 1000);

    } catch (err) {
      console.error('Error in bulk analysis:', err);
      toast({
        title: "Bulk analysis failed",
        description: err instanceof Error ? err.message : 'Bulk analysis failed',
        variant: "destructive"
      });
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setSystemProgress(0);
      }, 2000); // Keep progress visible for a bit
    }
  };

  const getProgressBadgeVariant = (progress: number) => {
    if (progress === 100) return "default";
    if (progress >= 50) return "secondary";
    if (progress > 0) return "outline";
    return "destructive";
  };

  const getSpamScoreBadgeVariant = (score?: number) => {
    if (!score) return "outline";
    if (score >= 75) return "destructive";
    if (score >= 50) return "secondary";
    return "default";
  };

  // Calculate system-wide stats
  const systemStats = {
    totalRepos: repositories.length,
    totalPrs: repositories.reduce((sum, repo) => sum + repo.total_prs, 0),
    analyzedPrs: repositories.reduce((sum, repo) => sum + repo.analyzed_prs, 0),
    pendingPrs: repositories.reduce((sum, repo) => sum + repo.pending_prs, 0),
    spamPrs: repositories.reduce((sum, repo) => sum + repo.spam_prs, 0),
    avgProgress: repositories.length > 0 
      ? Math.round(repositories.reduce((sum, repo) => sum + repo.analysis_progress, 0) / repositories.length)
      : 0
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading repository statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Bulk Spam Analysis</h1>
          <p className="text-muted-foreground">
            Analyze previous PRs across all repositories for spam detection
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error: _error}</AlertDescription>
        </Alert>
      )}

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Repositories</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.totalRepos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total PRs</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.totalPrs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Analyzed</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.analyzedPrs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.pendingPrs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Spam Found</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.spamPrs.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Progress</span>
            </div>
            <p className="text-2xl font-bold">{systemStats.avgProgress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={analyzeAllRepositories}
              disabled={isAnalyzing || systemStats.pendingPrs === 0}
              size="lg"
              className="flex-1"
            >
              {isAnalyzing
? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )
: (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isAnalyzing ? 'Analyzing...' : `Analyze All (${systemStats.pendingPrs.toLocaleString()} pending PRs)`}
            </Button>
            <Button onClick={fetchRepositoryStats} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
          
          {isAnalyzing && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">System Progress:</span>
                <span className="text-sm font-medium">{Math.round(systemProgress)}%</span>
              </div>
              <Progress value={systemProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(value: unknown) => setFilterStatus(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repositories</SelectItem>
                <SelectItem value="pending">Has Pending PRs</SelectItem>
                <SelectItem value="partial">Partially Analyzed</SelectItem>
                <SelectItem value="analyzed">Fully Analyzed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Repositories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Repositories ({filteredRepos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Total PRs</TableHead>
                  <TableHead>Analyzed</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Spam Found</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Avg Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepos.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{repo.full_name}</div>
                        {repo.last_analyzed_at && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(repo.last_analyzed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{repo.total_prs.toLocaleString()}</TableCell>
                    <TableCell>{repo.analyzed_prs.toLocaleString()}</TableCell>
                    <TableCell>
                      {repo.pending_prs > 0
? (
                        <Badge variant="destructive">{repo.pending_prs.toLocaleString()}</Badge>
                      )
: (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {repo.spam_prs > 0
? (
                        <Badge variant="destructive">{repo.spam_prs.toLocaleString()}</Badge>
                      )
: (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getProgressBadgeVariant(repo.analysis_progress)}>
                          {repo.analysis_progress}%
                        </Badge>
                        {repo.analysis_progress < 100 && repo.analysis_progress > 0 && (
                          <Progress value={repo.analysis_progress} className="w-16 h-2" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {repo.avg_spam_score !== undefined
? (
                        <Badge variant={getSpamScoreBadgeVariant(repo.avg_spam_score)}>
                          {repo.avg_spam_score}%
                        </Badge>
                      )
: (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {repo.pending_prs > 0 && (
                          <Button
                            onClick={() => analyzeRepository(repo.id, repo.full_name)}
                            size="sm"
                            disabled={isAnalyzing}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Analyze
                          </Button>
                        )}
                        <Button
                          onClick={() => analyzeRepository(repo.id, repo.full_name, true)}
                          variant="outline"
                          size="sm"
                          disabled={isAnalyzing}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Re-analyze
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      {bulkJobs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Analysis Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bulkJobs.slice(-5).reverse().map((job, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{job.repository_name}</span>
                    {job.status === 'completed' && (
                      <span className="text-sm text-muted-foreground ml-2">
                        Processed: {job.processed}, Errors: {job.errors}
                      </span>
                    )}
                    {job.error_message && (
                      <div className="text-sm text-red-600">{job.error_message}</div>
                    )}
                  </div>
                  <Badge 
                    variant={
                      job.status === 'completed'
? 'default' :
                      job.status === 'running'
? 'secondary' :
                      job.status === 'failed' ? 'destructive' : 'outline'
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}