import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  XCircle,
  Database,
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Filter,
} from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useTimeFormatter } from '@/hooks/use-time-formatter';

interface BackgroundJob {
  id: string;
  job_type: string;
  status: string;
  error: string | null;
  repository_id: string | null;
  processor_type: string | null;
  time_range_days: number | null;
  workflow_run_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobWithRepo extends BackgroundJob {
  repository_name: string | null;
}

type SortOption = 'created_at' | 'repository_name' | 'job_type';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 25;

export function FailedJobsDashboard() {
  const [failedJobs, setFailedJobs] = useState<JobWithRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterRepo, setFilterRepo] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    last24h: 0,
    byType: {} as Record<string, number>,
    byMode: {} as Record<string, number>,
  });

  const { formatRelativeTime } = useTimeFormatter();

  const fetchFailedJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query with filters
      let query = supabase
        .from('progressive_capture_jobs')
        .select('*', { count: 'exact' })
        .eq('status', 'failed');

      // Apply repository filter if set
      if (filterRepo !== 'all') {
        // First get the repository ID
        const { data: repoData } = await supabase
          .from('repositories')
          .select('id')
          .eq('full_name', filterRepo)
          .maybeSingle();

        if (repoData) {
          query = query.eq('repository_id', repoData.id);
        }
      }

      // Apply sorting
      const orderColumn = sortBy === 'job_type' ? 'job_type' : 'created_at';
      query = query.order(orderColumn, { ascending: sortDirection === 'asc' });

      // Apply pagination
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      query = query.range(offset, offset + ITEMS_PER_PAGE - 1);

      const { data: jobs, error: jobsError, count } = await query;

      if (jobsError) throw jobsError;

      setTotalCount(count || 0);

      if (!jobs || jobs.length === 0) {
        setFailedJobs([]);
        if (currentPage === 1) {
          setStats({ total: 0, last24h: 0, byType: {}, byMode: {} });
        }
        return;
      }

      // Fetch repository names for jobs with repository_id
      const repoIds = jobs.filter((job) => job.repository_id).map((job) => job.repository_id);

      let repoMap: Record<string, string> = {};
      if (repoIds.length > 0) {
        const { data: repos } = await supabase
          .from('repositories')
          .select('id, full_name')
          .in('id', repoIds);

        if (repos) {
          repoMap = repos.reduce(
            (acc, repo) => {
              acc[repo.id] = repo.full_name;
              return acc;
            },
            {} as Record<string, string>
          );
        }
      }

      // Combine jobs with repository names
      const jobsWithRepos: JobWithRepo[] = jobs.map((job) => ({
        ...job,
        repository_name: job.repository_id ? repoMap[job.repository_id] || null : null,
      }));

      setFailedJobs(jobsWithRepos);

      // Calculate stats only on first page with no filters
      if (currentPage === 1 && filterRepo === 'all') {
        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        const last24hJobs = jobsWithRepos.filter(
          (job) => job.created_at && new Date(job.created_at).getTime() > twentyFourHoursAgo
        );

        const byType = jobsWithRepos.reduce(
          (acc, job) => {
            acc[job.job_type] = (acc[job.job_type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const byMode = jobsWithRepos.reduce(
          (acc, job) => {
            const mode = job.processor_type || 'unknown';
            acc[mode] = (acc[mode] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        setStats({
          total: count || 0,
          last24h: last24hJobs.length,
          byType,
          byMode,
        });
      }
    } catch (err) {
      console.error('Failed to fetch failed jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load failed jobs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch unique repositories for filter dropdown
  const [uniqueRepos, setUniqueRepos] = useState<string[]>([]);

  const fetchUniqueRepos = async () => {
    try {
      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('repository_id')
        .eq('status', 'failed')
        .not('repository_id', 'is', null);

      if (jobs && jobs.length > 0) {
        const repoIds = [...new Set(jobs.map((j) => j.repository_id))];
        const { data: repos } = await supabase
          .from('repositories')
          .select('full_name')
          .in('id', repoIds);

        if (repos) {
          setUniqueRepos(repos.map((r) => r.full_name).sort());
        }
      }
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
    }
  };

  useEffect(() => {
    fetchUniqueRepos();
  }, []);

  useEffect(() => {
    fetchFailedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterRepo, sortBy, sortDirection]);

  const toggleExpanded = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getJobTypeColor = (type: string): 'default' | 'secondary' | 'destructive' => {
    if (type.includes('capture')) return 'secondary';
    if (type.includes('classify')) return 'default';
    return 'destructive';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchFailedJobs} className="gap-2">
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              Failed Jobs Monitor
            </h1>
            <p className="text-muted-foreground">Track and troubleshoot failed background jobs</p>
          </div>
          <Button onClick={fetchFailedJobs} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Failed Jobs</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Last 100 failures</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last24h}</div>
              <p className="text-xs text-muted-foreground">In the last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Modes</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.byMode).map(([mode, count]) => (
                  <div key={mode} className="flex justify-between text-sm">
                    <span className="capitalize">{mode}:</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Sort Controls */}
        {failedJobs.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter:</span>
                <Select
                  value={filterRepo}
                  onValueChange={(value) => {
                    setFilterRepo(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All repositories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All repositories</SelectItem>
                    {uniqueRepos.map((repo) => (
                      <SelectItem key={repo} value={repo}>
                        {repo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sort by:</span>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as SortOption);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Created date</SelectItem>
                    <SelectItem value="repository_name">Repository</SelectItem>
                    <SelectItem value="job_type">Job type</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toggleSortDirection();
                    setCurrentPage(1);
                  }}
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {totalCount > 0 && (
                  <Badge variant="secondary">
                    {totalCount} total {totalCount === 1 ? 'job' : 'jobs'}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Failed Jobs List */}
        {failedJobs.length === 0 ? (
          <Card className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {totalCount === 0 ? 'No Failed Jobs' : 'No Matching Jobs'}
            </h3>
            <p className="text-muted-foreground">
              {totalCount === 0
                ? 'All jobs are processing successfully! 🎉'
                : 'Try adjusting your filters'}
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {failedJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden">
                  <div className="p-6">
                    {/* Job Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getJobTypeColor(job.job_type)}>{job.job_type}</Badge>
                          {job.processor_type && (
                            <Badge variant="outline" className="capitalize">
                              {job.processor_type}
                            </Badge>
                          )}
                          {job.time_range_days && (
                            <Badge variant="secondary">Range: {job.time_range_days} days</Badge>
                          )}
                        </div>

                        {job.repository_name && (
                          <p className="text-sm text-muted-foreground font-mono">
                            {job.repository_name}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(job.id)}
                        className="ml-4"
                      >
                        {expandedJob === job.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Error Message */}
                    {job.error && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                        <p className="text-sm text-destructive font-mono break-all">{job.error}</p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(job.created_at)}
                      </span>
                      {job.workflow_run_id && <span>Run ID: {job.workflow_run_id}</span>}
                    </div>

                    {/* Expanded Details */}
                    {expandedJob === job.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Job ID</h4>
                          <p className="text-sm font-mono text-muted-foreground">{job.id}</p>
                        </div>

                        {job.metadata && Object.keys(job.metadata).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Metadata</h4>
                            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                              {JSON.stringify(job.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const title = encodeURIComponent(
                                `Failed Job: ${job.job_type} - ${job.repository_name || 'Unknown Repo'}`
                              );
                              const body = encodeURIComponent(
                                `## Failed Job Details

**Job ID:** \`${job.id}\`
**Job Type:** \`${job.job_type}\`
**Processor:** \`${job.processor_type || 'unknown'}\`
**Repository:** ${job.repository_name || 'N/A'}
**Time Range:** ${job.time_range_days ? `${job.time_range_days} days` : 'N/A'}
**Created:** ${new Date(job.created_at).toLocaleString()}
${job.completed_at ? `**Completed:** ${new Date(job.completed_at).toLocaleString()}` : ''}
${job.workflow_run_id ? `**Workflow Run ID:** ${job.workflow_run_id}` : ''}

## Error Message

\`\`\`
${job.error || 'No error message available'}
\`\`\`

## Metadata

\`\`\`json
${JSON.stringify(job.metadata, null, 2)}
\`\`\`

## Steps to Reproduce

1.
2.
3.

## Expected Behavior



## Actual Behavior


`
                              );
                              window.open(
                                `https://github.com/bdougie/contributor.info/issues/new?title=${title}&body=${body}&labels=bug,failed-job`,
                                '_blank'
                              );
                            }}
                          >
                            Report Issue on GitHub
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.open('https://app.inngest.com/env/production/runs', '_blank');
                            }}
                          >
                            View in Inngest
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Card className="p-4 mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
