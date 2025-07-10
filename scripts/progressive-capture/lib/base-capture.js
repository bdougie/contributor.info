import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { HybridGitHubClient } from './hybrid-github-client.js';
import { RateLimiter } from './rate-limiter.js';
import { ProgressTracker } from './progress-tracker.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BaseCaptureScript {
  constructor(options) {
    this.repositoryId = options.repositoryId;
    this.repositoryName = options.repositoryName;
    this.jobId = options.jobId;
    
    // Initialize clients
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    // Initialize hybrid client (GraphQL + REST fallback)
    this.hybridClient = new HybridGitHubClient(process.env.GITHUB_TOKEN);
    
    this.rateLimiter = new RateLimiter(this.octokit);
    this.progressTracker = new ProgressTracker(this.supabase, this.jobId);
    
    // Ensure logs directory exists (in scripts/progressive-capture/logs)
    this.logsDir = path.resolve(__dirname, '..', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  async run() {
    try {
      console.log(`Starting ${this.constructor.name} for repository ${this.repositoryName}`);
      
      await this.progressTracker.start(this.getTotalItems());
      
      const items = await this.getItemsToProcess();
      console.log(`Processing ${items.length} items...`);
      
      let processed = 0;
      let failed = 0;
      
      for (const item of items) {
        try {
          await this.rateLimiter.checkAndWait();
          await this.processItem(item);
          await this.progressTracker.increment();
          processed++;
          
          // Log progress every 10 items
          if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${items.length} items processed`);
          }
        } catch (error) {
          console.error(`Error processing item ${item.id || item.number}:`, error);
          await this.progressTracker.recordError(item.id || item.number, error);
          failed++;
        }
      }
      
      await this.progressTracker.complete();
      
      console.log(`Completed: ${processed} processed, ${failed} failed`);
      
      // Get performance metrics
      const metrics = this.hybridClient.getMetrics();
      const rateLimit = this.hybridClient.getRateLimit();
      
      console.log(`Performance Metrics:`, {
        graphqlQueries: metrics.graphqlQueries,
        restQueries: metrics.restQueries,
        fallbacks: metrics.fallbacks,
        totalPointsSaved: metrics.totalPointsSaved,
        fallbackRate: `${metrics.fallbackRate.toFixed(1)}%`,
        efficiency: metrics.efficiency.toFixed(2)
      });
      
      if (rateLimit) {
        console.log(`Final Rate Limit:`, {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetAt: rateLimit.resetAt
        });
      }
      
      // Write summary to logs
      const summary = {
        jobId: this.jobId,
        repositoryId: this.repositoryId,
        repositoryName: this.repositoryName,
        totalItems: items.length,
        processed,
        failed,
        completedAt: new Date().toISOString(),
        metrics,
        rateLimit
      };
      
      fs.writeFileSync(
        path.join(this.logsDir, `${this.jobId}-summary.json`),
        JSON.stringify(summary, null, 2)
      );
      
    } catch (error) {
      console.error('Script execution failed:', error);
      await this.progressTracker.fail(error);
      throw error;
    }
  }

  // Override in subclasses
  async getItemsToProcess() {
    throw new Error('getItemsToProcess must be implemented in subclass');
  }

  async processItem(item) {
    throw new Error('processItem must be implemented in subclass');
  }

  getTotalItems() {
    return 0;
  }
  
  // Utility method for logging
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    // Also write to log file
    const logFile = path.join(this.logsDir, `${this.jobId}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
  }
}