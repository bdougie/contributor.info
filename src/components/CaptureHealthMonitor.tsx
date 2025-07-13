import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { jobStatusReporter } from '@/lib/progressive-capture/job-status-reporter';
import { hybridQueueManager } from '@/lib/progressive-capture/hybrid-queue-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStats {
  inngest: { pending: number; processing: number; completed: number; failed: number };
  github_actions: { pending: number; processing: number; completed: number; failed: number };
  total: { pending: number; processing: number; completed: number; failed: number };
}

interface JobSummary {
  id: string;
  type: string;
  processor: string;
  status: string;
  repository_id: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration?: number;
  progress?: {
    total_items: number;
    processed_items: number;
    failed_items: number;
  };
  error?: string;
}

export function CaptureHealthMonitor() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue statistics
  const fetchStats = async () => {
    try {
      const queueStats = await hybridQueueManager.getHybridStats();
      setStats(queueStats);
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    }
  };

  // Fetch recent jobs
  const fetchRecentJobs = async () => {
    try {
      const { data: jobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*, progressive_capture_progress(*)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobs) {
        const jobSummaries = jobs.map(job => ({
          id: job.id,
          type: job.job_type,
          processor: job.processor_type,
          status: job.status,
          repository_id: job.repository_id,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          duration: job.completed_at && job.started_at
            ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
            : undefined,
          progress: job.progressive_capture_progress?.[0],
          error: job.error
        }));
        setRecentJobs(jobSummaries);
      }
    } catch (error) {
      console.error('Failed to fetch recent jobs:', error);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentJobs()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 5 seconds if enabled
    const interval = autoRefresh ? setInterval(loadData, 5000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Subscribe to real-time updates for active jobs
  useEffect(() => {
    const activeJobs = recentJobs.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    );

    const unsubscribes = activeJobs.map(job => 
      jobStatusReporter.subscribeToJobUpdates(job.id, () => {
        fetchRecentJobs();
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [recentJobs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Capture Health Monitor</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => Promise.all([fetchStats(), fetchRecentJobs()])}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Queue Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inngest Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inngest Queue</CardTitle>
              <CardDescription>Real-time processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="font-medium">{stats.inngest.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Processing</span>
                  <span className="font-medium">{stats.inngest.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="font-medium text-green-600">{stats.inngest.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="font-medium text-red-600">{stats.inngest.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GitHub Actions Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">GitHub Actions Queue</CardTitle>
              <CardDescription>Bulk processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="font-medium">{stats.github_actions.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Processing</span>
                  <span className="font-medium">{stats.github_actions.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="font-medium text-green-600">{stats.github_actions.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="font-medium text-red-600">{stats.github_actions.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Overview</CardTitle>
              <CardDescription>Combined statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="font-medium">{stats.total.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Processing</span>
                  <span className="font-medium">{stats.total.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="font-medium text-green-600">{stats.total.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="font-medium text-red-600">{stats.total.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Last 20 capture jobs across all processors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <div className="font-medium">{job.type}</div>
                    <div className="text-sm text-gray-500">
                      {job.repository_id} • {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Progress */}
                  {job.progress && job.status === 'processing' && (
                    <div className="w-32">
                      <Progress 
                        value={(job.progress.processed_items / job.progress.total_items) * 100} 
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {job.progress.processed_items}/{job.progress.total_items}
                      </div>
                    </div>
                  )}
                  
                  {/* Duration */}
                  <div className="text-sm text-gray-500 w-20 text-right">
                    {formatDuration(job.duration)}
                  </div>
                  
                  {/* Processor */}
                  <Badge variant="outline" className="text-xs">
                    {job.processor}
                  </Badge>
                  
                  {/* Status */}
                  <Badge className={cn('text-xs', getStatusColor(job.status))}>
                    {job.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}