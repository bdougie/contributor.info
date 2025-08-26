import { toast } from 'sonner';

/**
 * UI Notification Service for Progressive Data Capture
 * Provides user-friendly notifications when data is being fetched/processed
 */
export class ProgressiveCaptureNotifications {
  private static notificationIds = new Map<string, string | number>();

  /**
   * Show notification when background data fetching starts
   */
  static showJobsQueued(_jobCount: number, _jobType: string, repository?: string) {
    // Use user-friendly language following @docs/user-experience/ guidelines
    const message = repository 
      ? `Updating ${repository}...`
      : 'Fetching data in the background...';
    
    const description = 'We are fetching data in the background';
    
    const toastId = toast.info(message, {
      description,
      duration: 4000
    });

    return toastId;
  }

  /**
   * Show notification when background processing starts
   */
  static showProcessingStarted(
    repository: string, 
    processor?: 'inngest' | 'github_actions' | 'hybrid',
    estimatedTime?: number,
    githubActionsUrl?: string
  ) {
    const processorText = processor === 'inngest'
? 'Real-time processing' :
                         processor === 'github_actions'
? 'Bulk processing' :
                         processor === 'hybrid'
? 'Hybrid processing' :
                         'Processing';

    const timeText = estimatedTime ? ` (~${Math.round(estimatedTime/1000)}s)` : '';
    const completionTime = estimatedTime ? new Date(Date.now() + estimatedTime).toLocaleTimeString() : null;
    
    const toastId = toast.loading(`Updating ${repository}...`, {
      description: `${processorText}${timeText}${completionTime ? ` • Expected: ${completionTime}` : ''} • We are fetching data in the background`,
      duration: Infinity, // Keep open until processing complete
      action: githubActionsUrl
? {
        label: 'View Progress',
        onClick: () => window.open(githubActionsUrl, '_blank')
      }
: undefined
    });

    this.notificationIds.set(`processing_${repository}`, toastId);
    
    // Emit custom event for UI components with processor info
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('progressive-processing-started', {
        detail: { repository, processor, estimatedTime, githubActionsUrl }
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
      const percent = Math.round((processed/total) * 100);
      toast.loading(`Updating ${repository}...`, {
        id: existingId,
        description: `We are fetching data in the background (${percent}% complete)`,
      });
    }
  }

  /**
   * Show success notification when processing completes
   */
  static showProcessingComplete(
    repository: string, 
    updatedFeatures: string[],
    processor?: 'inngest' | 'github_actions' | 'hybrid'
  ) {
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

    const processorText = processor === 'inngest'
? 'Real-time' :
                         processor === 'github_actions'
? 'Bulk' :
                         processor === 'hybrid'
? 'Hybrid' :
                         '';

    const processorSuffix = processorText ? ` • ${processorText} processing complete` : '';

    toast.success(`Updated ${repository}!`, {
      description: `Fresh data available for: ${features}${processorSuffix}`,
      duration: 5000,
      action: {
        label: 'Refresh Page',
        onClick: () => window.location.reload()
      }
    });
    
    // Emit custom event for UI components with processor info
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('progressive-data-updated', {
        detail: { repository, updatedFeatures, processor }
      }));
    }
  }

  /**
   * Show error notification when processing fails
   */
  static showProcessingError(repository: string, _error: string) {
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
  static showDataAvailable(repository: string, _dataType: string) {
    if (_dataType === 'updated') {
      // Subtle notification for background updates
      toast.info(`Updating ${repository}...`, {
        description: 'We are fetching data in the background',
        duration: 4000
      });
    } else {
      toast.success(`Fresh data available!`, {
        description: `${repository} has been updated with the latest information`,
        duration: 6000,
        action: {
          label: 'Refresh',
          onClick: () => {
            window.location.reload();
          }
        }
      });
    }
  }

  /**
   * Show notification about missing data with action to fix
   */
  static showMissingDataNotification(repository: string, _missingTypes: string[]) {
    toast.info(`Updating ${repository}...`, {
      description: 'We are fetching data in the background',
      duration: 4000,
      action: {
        label: 'Check Status',
        onClick: () => {
          toast.info('Data is being updated', {
            description: 'Fresh information will be available shortly',
            duration: 3000
          });
        }
      }
    });
  }

  /**
   * Show rate limit warning
   */
  static showRateLimitWarning() {
    toast.warning('Using cached data', {
      description: 'Fresh data will be available shortly. We are fetching updates in the background.',
      duration: 6000
    });
  }

  /**
   * Show general warning message
   */
  static showWarning(message: string, duration: number = 6000) {
    toast.warning(message, {
      duration
    });
  }

  /**
   * Show completion status when background work finishes
   */
  static showQueueStatus(stats: { pending: number; processing: number; completed: number; failed: number }) {
    const { pending, processing, completed } = stats;
    
    if (pending === 0 && processing === 0 && completed > 0) {
      // Only show completion notification if we actually processed something
      toast.success('Data updated!', {
        description: 'Fresh information is now available',
        duration: 6000,
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        }
      });
    }
    // Don't show progress notifications - they're too noisy for users
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