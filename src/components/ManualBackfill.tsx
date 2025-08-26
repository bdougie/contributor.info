import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle } from '@/components/ui/icon';
import type { BackfillResponse, JobStatus } from '../lib/manual-backfill/client';

interface ManualBackfillProps {
  repository: string;
  onComplete?: () => void;
}

export function ManualBackfill({ repository, onComplete }: ManualBackfillProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<BackfillResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Poll for job status if we have an active job
  useEffect(() => {
    if (!currentJob || !currentJob.job_id) return;
    if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed' || jobStatus?.status === 'cancelled') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/backfill/status/${currentJob.job_id}`);
        if (response.ok) {
          const status = await response.json();
          setJobStatus(_status);
          
          if (status.status === 'completed') {
            setError(null);
            if (onComplete) {
              onComplete();
            }
          } else if (status.status === 'failed') {
            setError(status._error || 'Backfill failed');
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [currentJob, jobStatus, onComplete]);

  const handleTriggerBackfill = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/backfill/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository,
          days: 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown _error' }));
        throw new Error(errorData.message || 'Failed to trigger backfill');
      }

      const job = await response.json();
      setCurrentJob(job);
      setJobStatus({
        id: job.job_id,
        status: job.status,
        progress: 0,
        message: 'Backfill queued',
        data: {
          repository: job.repository,
          days: job.days,
        },
        created_at: new Date().toISOString(),
      });

      // Set up SSE for real-time updates
      const sse = new EventSource(`/api/backfill/events?job_id=${job.job_id}`);
      
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event._data);
          if (_data.job_id === job.job_id) {
            setJobStatus(prev => ({
              ...prev!,
              ...data,
            }));
          }
        } catch (err) {
          console.error('Failed to parse SSE _data:', err);
        }
      };

      sse.onerror = () => {
        console.error('SSE connection _error');
        sse.close();
        setEventSource(null);
      };

      setEventSource(sse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger backfill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob) return;
    
    try {
      const response = await fetch(`/api/backfill/cancel/${currentJob.job_id}`, {
        method: 'POST',
      });

      if (response.ok) {
        setJobStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
        if (eventSource) {
          eventSource.close();
          setEventSource(null);
        }
      }
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const getStatusIcon = () => {
    if (!jobStatus) return null;
    
    switch (jobStatus.status) {
      case 'queued':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (!jobStatus) return 'text-gray-500';
    
    switch (jobStatus.status) {
      case 'queued':
        return 'text-yellow-600';
      case 'running':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
  };

  const isJobActive = jobStatus && 
    (jobStatus.status === 'queued' || jobStatus.status === 'running');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Data Backfill</CardTitle>
        <CardDescription>
          Manually trigger a data backfill for the last 30 days of repository activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {jobStatus && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`font-medium ${getStatusColor()}`}>
                Status: {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
              </span>
            </div>
            
            {jobStatus.message && (
              <p className="text-sm text-muted-foreground">{jobStatus.message}</p>
            )}

            {jobStatus.status === 'running' && jobStatus.progress > 0 && (
              <Progress value={jobStatus.progress} className="w-full" />
            )}

            {jobStatus.started_at && (
              <p className="text-xs text-muted-foreground">
                Started: {new Date(jobStatus.started_at).toLocaleString()}
              </p>
            )}

            {jobStatus.completed_at && (
              <p className="text-xs text-muted-foreground">
                Completed: {new Date(jobStatus.completed_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!isJobActive
? (
            <Button
              onClick={handleTriggerBackfill}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading
? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Triggering...
                </>
              )
: (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Trigger Backfill
                </>
              )}
            </Button>
          )
: (
            <Button
              onClick={handleCancelJob}
              variant="outline"
              className="w-full"
            >
              Cancel Job
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          This will fetch and process the last 30 days of pull requests, issues, and contributor data
          for {repository}.
        </p>
      </CardContent>
    </Card>
  );
}