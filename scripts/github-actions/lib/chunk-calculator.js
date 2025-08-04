/**
 * ChunkCalculator - Calculates optimal chunk sizes for progressive backfill
 * based on repository characteristics and system constraints
 */
export class ChunkCalculator {
  constructor(repositoryMetrics) {
    this.repositoryMetrics = repositoryMetrics;
  }

  /**
   * Calculate the optimal chunk size for processing PRs
   * @returns {number} Optimal chunk size
   */
  calculateOptimalChunkSize() {
    const { prCount, avgPrSize, rateLimit, priority } = this.repositoryMetrics;
    
    // Base chunk size
    let chunkSize = 25;
    
    // Adjust based on repository size
    if (prCount > 50000) {
      chunkSize = 5; // Ultra-large repos get tiny chunks
    } else if (prCount > 10000) {
      chunkSize = 10; // Very large repos get smaller chunks
    } else if (prCount > 5000) {
      chunkSize = 15;
    } else if (prCount > 1000) {
      chunkSize = 20;
    }
    
    // Adjust based on rate limit headroom
    if (rateLimit && rateLimit.remaining) {
      const rateLimitPercentage = rateLimit.remaining / rateLimit.limit;
      
      if (rateLimitPercentage < 0.1) {
        // Less than 10% remaining - use minimal chunks
        chunkSize = Math.max(3, Math.floor(chunkSize * 0.3));
      } else if (rateLimitPercentage < 0.25) {
        // Less than 25% remaining - reduce chunk size
        chunkSize = Math.max(5, Math.floor(chunkSize * 0.5));
      } else if (rateLimitPercentage > 0.75 && priority === 'high') {
        // Plenty of rate limit and high priority - increase chunk size
        chunkSize = Math.min(50, Math.floor(chunkSize * 1.5));
      }
    }
    
    // Adjust based on average PR complexity (if available)
    if (avgPrSize) {
      if (avgPrSize > 100) { // Large PRs with many files
        chunkSize = Math.max(5, Math.floor(chunkSize * 0.7));
      } else if (avgPrSize < 10) { // Small PRs
        chunkSize = Math.min(50, Math.floor(chunkSize * 1.3));
      }
    }
    
    // Apply priority multiplier
    if (priority === 'high') {
      chunkSize = Math.min(50, Math.floor(chunkSize * 1.2));
    } else if (priority === 'low') {
      chunkSize = Math.max(5, Math.floor(chunkSize * 0.8));
    }
    
    return chunkSize;
  }
  
  /**
   * Calculate how often to process chunks (in minutes)
   * @returns {number} Processing interval in minutes
   */
  calculateProcessingInterval() {
    const { priority, rateLimit, prCount } = this.repositoryMetrics;
    
    // Base interval
    let baseInterval = 30; // minutes
    
    // Adjust based on priority
    if (priority === 'high') {
      baseInterval = 15; // Process high priority repos more frequently
    } else if (priority === 'low') {
      baseInterval = 60; // Process low priority repos less frequently
    }
    
    // Adjust based on rate limit status
    if (rateLimit && rateLimit.remaining) {
      const rateLimitPercentage = rateLimit.remaining / rateLimit.limit;
      
      if (rateLimitPercentage < 0.2) {
        // Low rate limit - slow down processing
        baseInterval = Math.max(baseInterval * 2, 120);
      } else if (rateLimitPercentage > 0.8) {
        // High rate limit - can process more frequently
        baseInterval = Math.max(baseInterval * 0.5, 10);
      }
    }
    
    // Adjust based on repository size
    if (prCount > 10000) {
      // Large repos might need more frequent processing to complete in reasonable time
      baseInterval = Math.max(baseInterval * 0.75, 15);
    }
    
    return Math.round(baseInterval);
  }
  
  /**
   * Calculate estimated time to complete backfill
   * @param {number} remainingPRs - Number of PRs left to process
   * @param {number} chunkSize - Size of each chunk
   * @returns {object} Estimated completion time and metadata
   */
  calculateEstimatedCompletion(remainingPRs, chunkSize) {
    const chunksRemaining = Math.ceil(remainingPRs / chunkSize);
    const processingInterval = this.calculateProcessingInterval();
    
    // Assume each chunk takes about 1 minute to process
    const processingTimePerChunk = 1; // minutes
    
    // Calculate total time including intervals
    const totalMinutes = (chunksRemaining * processingInterval) + (chunksRemaining * processingTimePerChunk);
    
    // Convert to human-readable format
    const hours = Math.floor(totalMinutes / 60);
    const days = Math.floor(hours / 24);
    
    let estimatedTime;
    if (days > 0) {
      estimatedTime = `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      estimatedTime = `${hours} hour${hours > 1 ? 's' : ''} ${totalMinutes % 60} minute${totalMinutes % 60 !== 1 ? 's' : ''}`;
    } else {
      estimatedTime = `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
    }
    
    return {
      estimatedTime,
      totalMinutes,
      chunksRemaining,
      processingInterval,
      metadata: {
        chunkSize,
        remainingPRs,
        priority: this.repositoryMetrics.priority,
        rateLimitStatus: this.repositoryMetrics.rateLimit ? 
          `${this.repositoryMetrics.rateLimit.remaining}/${this.repositoryMetrics.rateLimit.limit}` : 
          'unknown'
      }
    };
  }
  
  /**
   * Determine if backfill should be paused based on system conditions
   * @returns {object} Whether to pause and reason
   */
  shouldPauseBackfill() {
    const { rateLimit, consecutiveErrors } = this.repositoryMetrics;
    
    // Check rate limit
    if (rateLimit && rateLimit.remaining < 100) {
      return {
        shouldPause: true,
        reason: 'rate_limit_low',
        message: `Rate limit too low: ${rateLimit.remaining} remaining`
      };
    }
    
    // Check consecutive errors
    if (consecutiveErrors && consecutiveErrors >= 3) {
      return {
        shouldPause: true,
        reason: 'too_many_errors',
        message: `Too many consecutive errors: ${consecutiveErrors}`
      };
    }
    
    // Check time of day (optional - avoid peak hours)
    const hour = new Date().getUTCHours();
    if (hour >= 13 && hour <= 17) { // 1 PM - 5 PM UTC (peak GitHub usage)
      const rateLimitPercentage = rateLimit ? rateLimit.remaining / rateLimit.limit : 1;
      if (rateLimitPercentage < 0.3) {
        return {
          shouldPause: true,
          reason: 'peak_hours_low_limit',
          message: 'Peak hours with low rate limit'
        };
      }
    }
    
    return {
      shouldPause: false,
      reason: null,
      message: null
    };
  }
}