import { supabase } from '../supabase';

export interface TrackingEventDetail {
  owner: string;
  repo: string;
  full_name: string;
}

/**
 * Initialize the auto-tracking service that listens for repository-tracked events
 * This should be called once when the app initializes
 */
export function initAutoTrackingService(): void {
  // Listen for repository-tracked events
  window.addEventListener('repository-tracked', ((event: Event) => {
    if (event instanceof CustomEvent) {
      handleRepositoryTracked(event as CustomEvent<TrackingEventDetail>);
    }
  }) as EventListener);
  
  console.log('Auto-tracking service initialized');
}

/**
 * Clean up the auto-tracking service
 */
export function cleanupAutoTrackingService(): void {
  window.removeEventListener('repository-tracked', ((event: Event) => {
    if (event instanceof CustomEvent) {
      handleRepositoryTracked(event as CustomEvent<TrackingEventDetail>);
    }
  }) as EventListener);
}

/**
 * Handle the repository-tracked event
 */
async function handleRepositoryTracked(event: CustomEvent<TrackingEventDetail>): Promise<void> {
  const { owner, repo, full_name } = event.detail;
  
  console.log(`Auto-tracking triggered for ${full_name}`);
  
  try {
    // First, ensure the repository exists in the repositories table
    const { data: existingRepo, error: checkError } = await supabase
      .from('repositories')
      .select('id, full_name')
      .eq('full_name', full_name)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected for new repos
      console.error('Error checking repository existence:', checkError);
      return;
    }
    
    if (!existingRepo) {
      // Repository doesn't exist in the main table, create it
      const { error: insertError } = await supabase
        .from('repositories')
        .insert({
          full_name,
          owner,
          name: repo,
          is_active: true,
          is_private: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();
      
      if (insertError) {
        console.error('Error creating repository:', insertError);
        return;
      }
      
      console.log(`Repository ${full_name} created in database`);
    }
    
    // Trigger initial data capture for the repository
    // This will fetch basic info and recent activity
    await triggerInitialCapture(owner, repo);
    
    // Show a success notification (if the app has a notification system)
    showNotification({
      type: 'success',
      title: 'Repository Added',
      message: `${full_name} has been added to tracking and initial data sync has started.`,
    });
    
  } catch (error) {
    console.error('Error in auto-tracking service:', error);
    
    showNotification({
      type: 'error',
      title: 'Tracking Failed',
      message: `Failed to track ${full_name}. Please try again.`,
    });
  }
}

/**
 * Trigger initial data capture for a newly tracked repository
 */
async function triggerInitialCapture(owner: string, repo: string): Promise<void> {
  try {
    // For now, we'll just log that the repository was tracked
    // The existing background processors will pick it up
    console.log(`Repository ${owner}/${repo} tracked successfully`);
    
    // The bootstrap method will be called periodically by the background processor
    // to ensure all tracked repositories have their data captured
    
    // Optionally, we could trigger a manual bootstrap here, but it would
    // affect all repositories, not just this one:
    // await ProgressiveCaptureTrigger.bootstrap();
    
  } catch (error) {
    console.error('Error in initial capture setup:', error);
  }
}

/**
 * Show a notification to the user
 * This integrates with the app's existing notification system
 */
function showNotification(options: {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}): void {
  // Check if the app has a toast/notification system
  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast({
      variant: options.type === 'error' ? 'destructive' : 'default',
      title: options.title,
      description: options.message,
    });
  } else {
    // Fallback to console logging
    console.log(`[${options.type.toUpperCase()}] ${options.title}: ${options.message}`);
  }
}

/**
 * Manually track a repository (can be called directly)
 */
export async function manuallyTrackRepository(owner: string, repo: string): Promise<boolean> {
  try {
    // Dispatch the tracking event
    window.dispatchEvent(new CustomEvent('repository-tracked', {
      detail: { 
        owner, 
        repo, 
        full_name: `${owner}/${repo}` 
      }
    }));
    
    return true;
  } catch (error) {
    console.error('Error manually tracking repository:', error);
    return false;
  }
}