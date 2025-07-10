export class ProgressTracker {
  constructor(supabase, jobId) {
    this.supabase = supabase;
    this.jobId = jobId;
    this.progressId = null;
    this.startTime = null;
    this.totalItems = 0;
    this.processedItems = 0;
    this.failedItems = 0;
    this.errors = [];
  }

  async start(totalItems = 0) {
    this.startTime = new Date();
    this.totalItems = totalItems;
    
    try {
      // Create progress record in database
      const { data: progress, error } = await this.supabase
        .from('progressive_capture_progress')
        .insert({
          job_id: this.jobId,
          total_items: totalItems,
          processed_items: 0,
          failed_items: 0,
          current_item: 'Starting...',
          errors: []
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create progress record:', error);
      } else {
        this.progressId = progress.id;
        console.log(`Progress tracking started for job ${this.jobId}`);
      }
    } catch (error) {
      console.error('Failed to start progress tracking:', error);
    }
  }

  async increment(currentItem = null) {
    this.processedItems++;
    
    if (this.progressId) {
      try {
        await this.supabase
          .from('progressive_capture_progress')
          .update({
            processed_items: this.processedItems,
            current_item: currentItem || `Item ${this.processedItems}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.progressId);
      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    }
  }

  async recordError(itemId, error) {
    this.failedItems++;
    this.errors.push({
      itemId,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    if (this.progressId) {
      try {
        await this.supabase
          .from('progressive_capture_progress')
          .update({
            failed_items: this.failedItems,
            errors: this.errors,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.progressId);
      } catch (error) {
        console.error('Failed to record error:', error);
      }
    }
  }

  async complete() {
    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    console.log(`Job completed in ${Math.round(duration / 1000)}s`);
    console.log(`Processed: ${this.processedItems}, Failed: ${this.failedItems}`);

    if (this.progressId) {
      try {
        await this.supabase
          .from('progressive_capture_progress')
          .update({
            processed_items: this.processedItems,
            failed_items: this.failedItems,
            current_item: 'Completed',
            updated_at: endTime.toISOString()
          })
          .eq('id', this.progressId);
      } catch (error) {
        console.error('Failed to mark progress as complete:', error);
      }
    }

    // Update job status to completed
    await this.updateJobStatus('completed');
  }

  async fail(error) {
    console.error('Job failed:', error);

    if (this.progressId) {
      try {
        await this.supabase
          .from('progressive_capture_progress')
          .update({
            current_item: 'Failed',
            errors: [...this.errors, {
              error: error.message,
              timestamp: new Date().toISOString()
            }],
            updated_at: new Date().toISOString()
          })
          .eq('id', this.progressId);
      } catch (updateError) {
        console.error('Failed to record job failure:', updateError);
      }
    }

    // Update job status to failed
    await this.updateJobStatus('failed', error.message);
  }

  async updateJobStatus(status, error = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'failed' && error) {
        updateData.error = error;
      }

      await this.supabase
        .from('progressive_capture_jobs')
        .update(updateData)
        .eq('id', this.jobId);
        
    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  // Get current progress for reporting
  getProgress() {
    return {
      totalItems: this.totalItems,
      processedItems: this.processedItems,
      failedItems: this.failedItems,
      percentage: this.totalItems > 0 ? Math.round((this.processedItems / this.totalItems) * 100) : 0,
      errors: this.errors
    };
  }
}