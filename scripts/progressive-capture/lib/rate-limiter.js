export class RateLimiter {
  constructor(octokit) {
    this.octokit = octokit;
    this.lastCheck = 0;
    this.remainingRequests = 5000;
    this.resetTime = 0;
    this.checkInterval = 10; // Check every 10 requests
    this.requestCount = 0;
  }

  async checkAndWait() {
    this.requestCount++;
    
    // Check rate limit every 10 requests or if we're running low
    if (this.requestCount % this.checkInterval === 0 || this.remainingRequests < 100) {
      await this.checkRateLimit();
    }
    
    // If we're running low on requests, wait
    if (this.remainingRequests < 50) {
      const waitTime = this.calculateWaitTime();
      if (waitTime > 0) {
        console.log(`Rate limit approaching. Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
        await this.checkRateLimit();
      }
    }
  }

  async checkRateLimit() {
    try {
      const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
      const core = rateLimit.resources.core;
      
      this.remainingRequests = core.remaining;
      this.resetTime = core.reset * 1000; // Convert to milliseconds
      this.lastCheck = Date.now();
      
      console.log(`Rate limit check: ${this.remainingRequests} requests remaining, resets at ${new Date(this.resetTime).toISOString()}`);
      
    } catch (error) {
      console.error('Failed to check rate limit:', error);
      // Fallback: wait a bit if we can't check
      await this.sleep(1000);
    }
  }

  calculateWaitTime() {
    const now = Date.now();
    const timeUntilReset = this.resetTime - now;
    
    if (timeUntilReset <= 0) {
      return 0;
    }
    
    // If we have very few requests left, wait until reset
    if (this.remainingRequests < 10) {
      return timeUntilReset;
    }
    
    // Otherwise, calculate a reasonable wait time
    const requestsPerSecond = this.remainingRequests / (timeUntilReset / 1000);
    if (requestsPerSecond > 1) {
      return 0; // No need to wait
    }
    
    // Wait for 1 second if we're going too fast
    return 1000;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Get rate limit status for reporting
  getStatus() {
    return {
      remainingRequests: this.remainingRequests,
      resetTime: this.resetTime,
      lastCheck: this.lastCheck
    };
  }
}