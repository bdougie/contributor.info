import { toast } from 'sonner';

/**
 * UI Notification Service for Progressive Data Capture
 * Provides user-friendly notifications when data is being fetched/processed
 */
export class ProgressiveCaptureNotifications {
  private static notificationIds = new Map<string, string | number>();

  /**
   * Show notification when jobs are queued
   */
  static showJobsQueued(jobCount: number, jobType: string, repository?: string) {
    const message = repository 
      ? `Queued ${jobCount} ${jobType} jobs for ${repository}`
      : `Queued ${jobCount} ${jobType} jobs`;
    
    const description = this.getJobTypeDescription(jobType);
    
    const toastId = toast.info(message, {
      description,
      duration: 4000,
      action: {
        label: 'View Status',
        onClick: () => {
          console.log('Queue Status:', 'Run ProgressiveCapture.status() in console');
          toast.info('Check browser console for ProgressiveCapture.status()');
        }
      }
    });

    return toastId;
  }

  /**
   * Show notification when background processing starts
   */
  static showProcessingStarted(repository: string) {
    const toastId = toast.loading(`Updating data for ${repository}...`, {
      description: 'Fetching latest information in the background',
      duration: Infinity, // Keep open until processing complete
    });

    this.notificationIds.set(`processing_${repository}`, toastId);
    
    // Emit custom event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('progressive-processing-started', {
        detail: { repository }
      }));
    }
    
    return toastId;
  }

  /**
   * Update processing notification with progress
   */
  static updateProcessingProgress(repository: string, processed: number, total: number) {
    const existingId = this.notificationIds.get(`processing_${repository}`);
    
    if (existingId) {
      toast.loading(`Updating ${repository}... (${processed}/${total})`, {
        id: existingId,
        description: `Processing repository data - ${Math.round((processed/total) * 100)}% complete`,
      });
    }
  }

  /**
   * Show success notification when processing completes
   */
  static showProcessingComplete(repository: string, updatedFeatures: string[]) {
    const existingId = this.notificationIds.get(`processing_${repository}`);
    
    // Dismiss the loading notification
    if (existingId) {
      toast.dismiss(existingId);
      this.notificationIds.delete(`processing_${repository}`);
    }

    // Show success notification
    const features = updatedFeatures.length > 0 
      ? updatedFeatures.join(', ')
      : 'repository data';

    toast.success(`Updated ${repository}!`, {
      description: `Fresh data available for: ${features}`,
      duration: 5000,
      action: {
        label: 'Refresh Page',
        onClick: () => window.location.reload()
      }
    });
    
    // Emit custom event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('progressive-data-updated', {
        detail: { repository, updatedFeatures }
      }));
    }
  }

  /**
   * Show error notification when processing fails
   */
  static showProcessingError(repository: string, error: string) {
    const existingId = this.notificationIds.get(`processing_${repository}`);
    
    // Dismiss the loading notification
    if (existingId) {
      toast.dismiss(existingId);
      this.notificationIds.delete(`processing_${repository}`);
    }

    // Show error notification
    toast.error(`Failed to update ${repository}`, {
      description: error,
      duration: 8000,
      action: {
        label: 'Retry',
        onClick: () => {
          console.log('Retry:', `Run ProgressiveCapture.quickFix('${repository.split('/')[0]}', '${repository.split('/')[1]}') in console`);
        }
      }
    });
  }

  /**
   * Show notification when new data becomes available
   */
  static showDataAvailable(repository: string, dataType: string) {
    toast.success(`New ${dataType} data available!`, {
      description: `${repository} has fresh ${dataType} data ready`,
      duration: 6000,
      action: {
        label: 'View',
        onClick: () => {
          // Trigger a soft refresh of the current view
          window.dispatchEvent(new CustomEvent('progressive-data-updated', { 
            detail: { repository, dataType } 
          }));
        }
      }
    });
  }

  /**
   * Show notification about missing data with action to fix
   */
  static showMissingDataNotification(repository: string, missingTypes: string[]) {
    const missing = missingTypes.join(', ');
    
    toast.warning(`${repository} is missing some data`, {
      description: `Missing: ${missing}. Click to start background update.`,
      duration: 10000,
      action: {
        label: 'Update Now',
        onClick: () => {
          const [owner, repo] = repository.split('/');
          this.triggerQuickFix(owner, repo);
        }
      }
    });
  }

  /**
   * Show rate limit warning
   */
  static showRateLimitWarning() {
    toast.warning('Approaching GitHub rate limit', {
      description: 'Data updates will be slower for a while. Using cached data.',
      duration: 6000
    });
  }

  /**
   * Show queue status summary
   */
  static showQueueStatus(stats: { pending: number; processing: number; completed: number; failed: number }) {
    const { pending, processing, completed, failed } = stats;
    
    if (pending === 0 && processing === 0) {
      toast.success('All data updates complete!', {
        description: `Processed ${completed} jobs successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        duration: 4000
      });
    } else {
      toast.info('Background updates in progress', {
        description: `${pending} pending, ${processing} processing, ${completed} completed`,
        duration: 3000
      });
    }
  }

  /**
   * Trigger quick fix from notification
   */
  private static async triggerQuickFix(owner: string, repo: string) {
    try {
      // Import and call the queue manager
      const { queueManager } = await import('./queue-manager');
      const { supabase } = await import('../supabase');
      
      // Find repository ID
      const { data: repoData, error } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .single();

      if (error || !repoData) {
        toast.error(`Repository ${owner}/${repo} not found in database`);
        return;
      }

      // Start processing notification
      this.showProcessingStarted(`${owner}/${repo}`);

      // Queue the jobs
      await Promise.all([
        queueManager.queueRecentPRs(repoData.id),
        queueManager.queueMissingFileChanges(repoData.id, 10),
        queueManager.queueRecentCommitsAnalysis(repoData.id, 90)
      ]);

      toast.success('Background update started!', {
        description: 'Fresh data will be available shortly',
        duration: 3000
      });

    } catch (error) {
      toast.error('Failed to start background update', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  }

  /**
   * Get user-friendly description for job types
   */
  private static getJobTypeDescription(jobType: string): string {
    const descriptions = {
      'pr_details': 'Fetching missing file changes and PR details',
      'recent_prs': 'Getting latest pull requests',
      'reviews': 'Loading PR reviews and collaboration data',
      'comments': 'Fetching discussion comments',
      'commit_pr_check': 'Analyzing commits for YOLO coder detection',
      'commits': 'Processing commit history'
    };

    return descriptions[jobType as keyof typeof descriptions] || 'Processing repository data';
  }

  /**
   * Dismiss all progressive capture notifications
   */
  static dismissAll() {
    this.notificationIds.forEach((id) => {
      toast.dismiss(id);
    });
    this.notificationIds.clear();
  }
}

// Export convenience functions
export const {
  showJobsQueued,
  showProcessingStarted,
  updateProcessingProgress,
  showProcessingComplete,
  showProcessingError,
  showDataAvailable,
  showMissingDataNotification,
  showRateLimitWarning,
  showQueueStatus
} = ProgressiveCaptureNotifications;