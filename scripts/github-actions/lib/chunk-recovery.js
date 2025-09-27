/**
 * ChunkRecovery - Handles recovery of stuck chunks in progressive backfill
 */
export class ChunkRecovery {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Find and recover stuck chunks
   * @param {number} stuckThresholdMinutes - Minutes after which a chunk is considered stuck
   * @returns {object} Recovery results
   */
  async recoverStuckChunks(stuckThresholdMinutes = 30) {
    const results = {
      foundStuckChunks: 0,
      recoveredChunks: 0,
      failedRecoveries: 0,
      errors: [],
    };

    try {
      // Find chunks that have been processing for too long
      const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString();

      const { data: stuckChunks, error } = await this.supabase
        .from('backfill_chunks')
        .select(
          `
          id,
          repository_id,
          backfill_state_id,
          chunk_number,
          pr_numbers,
          started_at,
          repositories!inner(owner, name)
        `
        )
        .eq('status', 'processing')
        .lt('started_at', stuckThreshold)
        .order('started_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to find stuck chunks: ${error.message}`);
      }

      if (!stuckChunks || stuckChunks.length === 0) {
        console.log('✅ No stuck chunks found');
        return results;
      }

      results.foundStuckChunks = stuckChunks.length;
      console.log(`🔍 Found ${stuckChunks.length} stuck chunks`);

      // Process each stuck chunk
      for (const chunk of stuckChunks) {
        try {
          await this.recoverChunk(chunk);
          results.recoveredChunks++;
        } catch (error) {
          console.error(`Failed to recover chunk ${chunk.id}: ${error.message}`);
          results.failedRecoveries++;
          results.errors.push({
            chunkId: chunk.id,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      console.error(`❌ Error in chunk recovery: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recover a single stuck chunk
   * @param {object} chunk - The stuck chunk to recover
   */
  async recoverChunk(chunk) {
    const processingTime = Date.now() - new Date(chunk.started_at).getTime();
    const processingMinutes = Math.floor(processingTime / 1000 / 60);

    console.log(
      `🔧 Recovering chunk ${chunk.chunk_number} for ${chunk.repositories.owner}/${chunk.repositories.name}`
    );
    console.log(`   Stuck for ${processingMinutes} minutes`);

    // Check if the chunk has actual PR data
    if (!chunk.pr_numbers || chunk.pr_numbers.length === 0) {
      // Mark as failed if no PR data
      await this.markChunkAsFailed(chunk.id, 'No PR data found in chunk');
      return;
    }

    // Check if PRs were actually processed
    const { count: processedPRs } = await this.supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', chunk.repository_id)
      .in('number', chunk.pr_numbers);

    const completionRate = processedPRs / chunk.pr_numbers.length;

    if (completionRate >= 0.8) {
      // If most PRs were processed, mark as completed
      console.log(
        `   ✅ ${processedPRs}/${chunk.pr_numbers.length} PRs found, marking as completed`
      );
      await this.markChunkAsCompleted(chunk.id, processedPRs);
    } else if (completionRate > 0) {
      // Partial completion - mark as failed with details
      console.log(`   ⚠️  Only ${processedPRs}/${chunk.pr_numbers.length} PRs processed`);
      await this.markChunkAsFailed(
        chunk.id,
        `Partial completion: ${processedPRs}/${chunk.pr_numbers.length} PRs`
      );
    } else {
      // No PRs processed - check if we should retry
      if (processingMinutes > 60) {
        // Too old, mark as failed
        await this.markChunkAsFailed(
          chunk.id,
          'Processing timeout - no PRs found after 60 minutes'
        );
      } else {
        // Recent enough to potentially still be processing
        console.log(`   ⏳ Chunk might still be processing (${processingMinutes} minutes old)`);
      }
    }
  }

  /**
   * Mark a chunk as completed
   */
  async markChunkAsCompleted(chunkId, processedCount) {
    const { error } = await this.supabase
      .from('backfill_chunks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        api_calls_made: processedCount,
        metadata: {
          recovered: true,
          recovered_at: new Date().toISOString(),
        },
      })
      .eq('id', chunkId);

    if (error) {
      throw new Error(`Failed to mark chunk as completed: ${error.message}`);
    }
  }

  /**
   * Mark a chunk as failed
   */
  async markChunkAsFailed(chunkId, reason) {
    const { error } = await this.supabase
      .from('backfill_chunks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: reason,
        metadata: {
          recovery_attempted: true,
          recovery_reason: reason,
          recovered_at: new Date().toISOString(),
        },
      })
      .eq('id', chunkId);

    if (error) {
      throw new Error(`Failed to mark chunk as failed: ${error.message}`);
    }
  }

  /**
   * Get statistics about chunk processing
   */
  async getChunkStatistics(backfillStateId = null) {
    try {
      let query = this.supabase.from('backfill_chunks').select('status', { count: 'exact' });

      if (backfillStateId) {
        query = query.eq('backfill_state_id', backfillStateId);
      }

      const { data: statusCounts, error } = await query;

      if (error) {
        throw new Error(`Failed to get chunk statistics: ${error.message}`);
      }

      // Group by status
      const stats = {
        total: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      // Since we can't use GROUP BY directly, we need to count each status
      for (const status of ['processing', 'completed', 'failed']) {
        const { count } = await this.supabase
          .from('backfill_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .then((result) => ({ count: result.count || 0 }));

        stats[status] = count;
        stats.total += count;
      }

      return stats;
    } catch (error) {
      console.error(`❌ Error getting chunk statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old completed chunks to save space
   * @param {number} daysToKeep - Number of days to keep completed chunks
   */
  async cleanupOldChunks(daysToKeep = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

      const { data: deletedChunks, error } = await this.supabase
        .from('backfill_chunks')
        .delete()
        .eq('status', 'completed')
        .lt('completed_at', cutoffDate)
        .select();

      if (error) {
        throw new Error(`Failed to cleanup old chunks: ${error.message}`);
      }

      console.log(`🧹 Cleaned up ${deletedChunks?.length || 0} old completed chunks`);
      return deletedChunks?.length || 0;
    } catch (error) {
      console.error(`❌ Error cleaning up chunks: ${error.message}`);
      throw error;
    }
  }
}
