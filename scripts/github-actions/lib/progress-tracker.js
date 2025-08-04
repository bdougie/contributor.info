/**
 * ProgressTracker - Manages backfill progress state in the database
 */
export class ProgressTracker {
  constructor(supabaseClient, backfillStateId) {
    this.supabase = supabaseClient;
    this.backfillStateId = backfillStateId;
  }

  /**
   * Update progress after processing a chunk
   * @param {number} processedCount - Number of PRs processed in this chunk
   * @param {string} lastCursor - Cursor for the last processed PR
   * @param {number} lastPrNumber - Last PR number processed
   */
  async updateProgress(processedCount, lastCursor, lastPrNumber = null) {
    try {
      // Get current state
      const { data: currentState, error: fetchError } = await this.supabase
        .from('progressive_backfill_state')
        .select('processed_prs, consecutive_errors')
        .eq('id', this.backfillStateId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch current state: ${fetchError.message}`);
      }

      // Update progress
      const { error: updateError } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          processed_prs: (currentState.processed_prs || 0) + processedCount,
          last_processed_cursor: lastCursor,
          last_processed_pr_number: lastPrNumber,
          last_processed_at: new Date().toISOString(),
          consecutive_errors: 0, // Reset on successful processing
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId);

      if (updateError) {
        throw new Error(`Failed to update progress: ${updateError.message}`);
      }

      console.log(`   ✅ Updated progress: +${processedCount} PRs processed`);
    } catch (error) {
      console.error(`❌ Error updating progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record an error during processing
   * @param {string} errorMessage - Error message to record
   */
  async recordError(errorMessage) {
    try {
      // Get current state
      const { data: currentState, error: fetchError } = await this.supabase
        .from('progressive_backfill_state')
        .select('error_count, consecutive_errors')
        .eq('id', this.backfillStateId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch current state: ${fetchError.message}`);
      }

      // Update error counts
      const { error: updateError } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          error_count: (currentState.error_count || 0) + 1,
          consecutive_errors: (currentState.consecutive_errors || 0) + 1,
          last_error: errorMessage,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId);

      if (updateError) {
        throw new Error(`Failed to record error: ${updateError.message}`);
      }

      console.log(`   ⚠️  Recorded error: ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Failed to record error: ${error.message}`);
    }
  }

  /**
   * Pause the backfill process
   * @param {string} reason - Reason for pausing
   */
  async pauseBackfill(reason) {
    try {
      // First get the current metadata
      const { data: currentState } = await this.supabase
        .from('progressive_backfill_state')
        .select('metadata')
        .eq('id', this.backfillStateId)
        .single();
      
      const updatedMetadata = {
        ...(currentState?.metadata || {}),
        pause_reason: reason,
        paused_at: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          status: 'paused',
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId);

      if (error) {
        throw new Error(`Failed to pause backfill: ${error.message}`);
      }

      console.log(`   ⏸️  Paused backfill: ${reason}`);
    } catch (error) {
      console.error(`❌ Error pausing backfill: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark the backfill as completed
   */
  async completeBackfill() {
    try {
      // Get current metadata
      const { data: currentState } = await this.supabase
        .from('progressive_backfill_state')
        .select('metadata')
        .eq('id', this.backfillStateId)
        .single();
      
      const updatedMetadata = {
        ...(currentState?.metadata || {}),
        completed_at: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          status: 'completed',
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId);

      if (error) {
        throw new Error(`Failed to complete backfill: ${error.message}`);
      }

      console.log(`   ✅ Completed backfill!`);
    } catch (error) {
      console.error(`❌ Error completing backfill: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the current backfill state
   * @returns {object} Current backfill state
   */
  async getCurrentState() {
    try {
      const { data, error } = await this.supabase
        .from('progressive_backfill_state')
        .select('*')
        .eq('id', this.backfillStateId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch backfill state: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Error fetching state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume a paused backfill
   */
  async resumeBackfill() {
    try {
      // Get current metadata
      const { data: currentState } = await this.supabase
        .from('progressive_backfill_state')
        .select('metadata')
        .eq('id', this.backfillStateId)
        .single();
      
      const updatedMetadata = {
        ...(currentState?.metadata || {}),
        resumed_at: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          status: 'active',
          consecutive_errors: 0, // Reset consecutive errors on resume
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId)
        .eq('status', 'paused'); // Only resume if currently paused

      if (error) {
        throw new Error(`Failed to resume backfill: ${error.message}`);
      }

      console.log(`   ▶️  Resumed backfill`);
    } catch (error) {
      console.error(`❌ Error resuming backfill: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update chunk size for future processing
   * @param {number} newChunkSize - New chunk size to use
   */
  async updateChunkSize(newChunkSize) {
    try {
      const { error } = await this.supabase
        .from('progressive_backfill_state')
        .update({
          chunk_size: newChunkSize,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.backfillStateId);

      if (error) {
        throw new Error(`Failed to update chunk size: ${error.message}`);
      }

      console.log(`   📏 Updated chunk size to ${newChunkSize}`);
    } catch (error) {
      console.error(`❌ Error updating chunk size: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if the backfill should continue
   * @returns {boolean} Whether to continue processing
   */
  async shouldContinue() {
    try {
      const state = await this.getCurrentState();
      
      // Don't continue if paused or completed
      if (state.status !== 'active') {
        console.log(`   ℹ️  Backfill is ${state.status}, stopping processing`);
        return false;
      }

      // Check if all PRs are processed
      if (state.processed_prs >= state.total_prs) {
        console.log(`   ✅ All PRs processed!`);
        await this.completeBackfill();
        return false;
      }

      // Check consecutive errors
      if (state.consecutive_errors >= 5) {
        console.log(`   ❌ Too many consecutive errors (${state.consecutive_errors}), pausing`);
        await this.pauseBackfill('too_many_errors');
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error checking if should continue: ${error.message}`);
      return false;
    }
  }
}