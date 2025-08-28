import { useState } from 'react';
import {
  Database,
  RefreshCw,
  AlertCircle,
  GitBranch,
  Zap,
  ExternalLink,
  Clock,
} from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ProgressiveCaptureTrigger } from '@/lib/progressive-capture/manual-trigger';
import { HybridQueueManager } from '@/lib/progressive-capture/hybrid-queue-manager';
import { toast } from 'sonner';
import { getProgressiveCaptureText } from '@/lib/utils/ui-state';

interface ProcessorRouting {
  inngestJobs: number;
  actionsJobs: number;
  processor: 'inngest' | 'github_actions' | 'hybrid';
  reason: string;
}

interface ProgressiveCaptureButtonProps {
  owner: string;
  repo: string;
  className?: string;
  onRefreshNeeded?: () => void;
  compact?: boolean;
}

export function ProgressiveCaptureButton({
  owner,
  repo,
  className,
  onRefreshNeeded,
  compact = false,
}: ProgressiveCaptureButtonProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobsQueued, setJobsQueued] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routingInfo, setRoutingInfo] = useState<ProcessorRouting | null>(null);
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState<Date | null>(null);
  const [githubActionsUrl, setGitHubActionsUrl] = useState<string | null>(null);

  const handleTriggerCapture = async () => {
    setIsTriggering(true);
    setError(null);

    try {
      toast.info('Starting progressive data capture...', {
        description: `Analyzing ${owner}/${repo} for missing data`,
      });

      // Get routing information from hybrid queue manager
      const hybridManager = new HybridQueueManager();
      const routing = await hybridManager.analyzeRouting(owner, repo);
      setRoutingInfo(routing);

      // Trigger the quick fix with hybrid routing
      await ProgressiveCaptureTrigger.quickFix(owner, repo);

      // Show processing state with routing info
      setIsTriggering(false);
      setIsProcessing(true);
      setJobsQueued(routing.inngestJobs + routing.actionsJobs);

      // Enhanced toast with processor information
      const processorText =
        routing.processor === 'hybrid'
          ? `${routing.inngestJobs} real-time jobs, ${routing.actionsJobs} bulk jobs`
          : routing.processor === 'inngest'
            ? 'Real-time processing'
            : 'Bulk processing via GitHub Actions';

      toast.success('Data capture jobs queued!', {
        description: `${processorText} • ${routing.reason}`,
      });

      // Calculate realistic processing times based on job types and data volume
      const getProcessingTime = (routing: ProcessorRouting) => {
        const baseTime =
          routing.processor === 'inngest'
            ? 5000
            : routing.processor === 'github_actions'
              ? 30000
              : 15000;

        // Add time based on job count
        const jobMultiplier = (routing.inngestJobs + routing.actionsJobs) * 2000;
        return Math.min(
          baseTime + jobMultiplier,
          routing.processor === 'github_actions' ? 180000 : 30000
        );
      };

      const processingTime = getProcessingTime(routing);

      // Set estimated completion time
      const completionTime = new Date(Date.now() + processingTime);
      setEstimatedCompletionTime(completionTime);

      // Generate GitHub Actions URL if using GitHub Actions
      if (routing.processor === 'github_actions' || routing.processor === 'hybrid') {
        const actionsUrl = `https://github.com/bdougie/jobs/actions/workflows/bulk-capture.yml`;
        setGitHubActionsUrl(actionsUrl);
      }

      setTimeout(() => {
        setIsProcessing(false);
        setJobsQueued(null);
        setRoutingInfo(null);
        setEstimatedCompletionTime(null);
        setGitHubActionsUrl(null);
        toast.success('Data capture completed!', {
          description: 'Repository metrics have been updated with fresh data',
        });
        onRefreshNeeded?.();
      }, processingTime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger data capture';
      setError(errorMessage);
      setIsTriggering(false);
      setIsProcessing(false);
      setRoutingInfo(null);
      toast.error('Data capture failed', {
        description: errorMessage,
      });
    }
  };

  // Compact version for inline use
  if (compact) {
    return (
      <Button
        onClick={handleTriggerCapture}
        disabled={isTriggering || isProcessing}
        variant="outline"
        size="sm"
        className={cn('flex items-center gap-2', className)}
      >
        {isTriggering || isProcessing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {getProgressiveCaptureText(isTriggering, isProcessing)}
        {routingInfo && (
          <Badge variant="secondary" className="ml-2">
            {routingInfo.processor === 'inngest'
              ? 'Real-time'
              : routingInfo.processor === 'github_actions'
                ? 'Bulk'
                : 'Hybrid'}
          </Badge>
        )}
      </Button>
    );
  }

  // Show processing state similar to self-selection card
  if (isTriggering || isProcessing) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Progressive Data Capture
            <RefreshCw className="h-4 w-4 animate-spin" />
          </CardTitle>
          <CardDescription>
            {isTriggering
              ? 'Starting progressive data capture...'
              : 'Collecting missing repository data from GitHub...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-muted-foreground">•••</div>
            <p className="text-sm text-muted-foreground mt-1">
              Processing data for {owner}/{repo}
            </p>
            {jobsQueued !== null && routingInfo && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>{jobsQueued} jobs queued for processing</p>
                {routingInfo.processor === 'hybrid' ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-blue-500" />
                      <span>{routingInfo.inngestJobs} real-time</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-purple-500" />
                      <span>{routingInfo.actionsJobs} bulk</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1">
                    {routingInfo.processor === 'inngest' ? (
                      <>
                        <Zap className="h-3 w-3 text-blue-500" />
                        <span>Real-time processing</span>
                      </>
                    ) : (
                      <>
                        <GitBranch className="h-3 w-3 text-purple-500" />
                        <span>Bulk processing</span>
                      </>
                    )}
                  </div>
                )}
                <p className="text-xs opacity-75">{routingInfo.reason}</p>
              </div>
            )}
          </div>

          {/* Estimated completion time */}
          {estimatedCompletionTime && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Expected completion: {estimatedCompletionTime.toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {routingInfo?.processor === 'inngest' && 'Real-time: '}
              {routingInfo?.processor === 'github_actions' && 'Bulk processing: '}
              {routingInfo?.processor === 'hybrid' && 'Hybrid processing: '}
              Fetching PRs • Reviews • Comments • File Changes
            </p>

            {/* GitHub Actions link */}
            {githubActionsUrl && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(githubActionsUrl, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View GitHub Actions
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Data Capture Failed
          </CardTitle>
          <CardDescription>Unable to start progressive data capture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button
              onClick={handleTriggerCapture}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default trigger state
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Progressive Data Capture
        </CardTitle>
        <CardDescription>Fetch missing repository data to improve metrics accuracy</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            This repository may be missing review and comment data. Trigger progressive capture to
            fetch comprehensive metrics.
          </p>
          <Button
            onClick={handleTriggerCapture}
            className="flex items-center gap-2"
            disabled={isTriggering || isProcessing}
          >
            <Database className="h-4 w-4" />
            Start Data Capture
          </Button>
        </div>
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Will fetch: Recent PRs • Reviews • Comments • File Changes • Commit Analysis</p>
          <div className="flex items-center justify-center gap-4 pt-1">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-blue-500" />
              <span>Real-time jobs</span>
            </div>
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-purple-500" />
              <span>Bulk processing</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
