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
} from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

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

export function FailedJobsDashboard() {
  const [failedJobs, setFailedJobs] = useState<JobWithRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    last24h: 0,
    byType: {} as Record<string, number>,
    byMode: {} as Record<string, number>,
  });

  const fetchFailedJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch failed jobs from progressive_capture_jobs table
      const { data: jobs, error: jobsError } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (jobsError) throw jobsError;

      if (!jobs || jobs.length === 0) {
        setFailedJobs([]);
        setStats({ total: 0, last24h: 0, byType: {}, byMode: {} });
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

      // Calculate stats
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
        total: jobsWithRepos.length,
        last24h: last24hJobs.length,
        byType,
        byMode,
      });
    } catch (err) {
      console.error('Failed to fetch failed jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load failed jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  const toggleExpanded = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
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

        {/* Failed Jobs List */}
        {failedJobs.length === 0 ? (
          <Card className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Failed Jobs</h3>
            <p className="text-muted-foreground">All jobs are processing successfully! 🎉</p>
          </Card>
        ) : (
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
                      Created: {formatDate(job.created_at)}
                    </span>
                    {job.completed_at && <span>Completed: {formatDate(job.completed_at)}</span>}
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
        )}
      </div>
    </div>
  );
}
