import { supabase } from '../supabase-server';

/**
 * Updates the status of a progressive_capture_jobs record
 * Should be called at the end of every Inngest function to mark jobs as complete
 */
export async function updateJobStatus(
  jobId: string | undefined,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  if (!jobId) {
    console.warn('[JobStatusUpdater] No jobId provided, skipping status update');
    return;
  }

  const updates: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString(),
  };

  if (error) {
    updates.error = error;
  }

  const { error: updateError } = await supabase
    .from('progressive_capture_jobs')
    .update(updates)
    .eq('id', jobId);

  if (updateError) {
    console.error(`[JobStatusUpdater] Failed to update job ${jobId}:`, updateError);
  } else {
    console.log(`[JobStatusUpdater] Job ${jobId} marked as ${status}`);
  }
}
