/**
 * Manual Backfill API Server Client
 *
 * Server-side client for use in Netlify Functions and server environments
 */

import type { BackfillRequest, BackfillResponse, JobStatus, JobListResponse } from './client';

class ManualBackfillServerClient {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    // Use process.env directly in server context
    this.apiUrl = process.env.GH_DATPIPE_API_URL || 'https://gh-datapipe.fly.dev';
    this.apiKey = process.env.GH_DATPIPE_KEY || '';

    if (!this.apiKey) {
      console.error('[ManualBackfillServerClient] GH_DATPIPE_KEY not configured');
    }
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  /**
   * Trigger a manual backfill for a repository
   */
  async triggerBackfill(request: BackfillRequest): Promise<BackfillResponse> {
    if (!this.apiKey) {
      throw new Error('GH_DATPIPE_KEY not configured');
    }

    const webhookUrl =
      request.callback_url ||
      (process.env.BASE_URL || 'https://contributor.info') + '/api/webhook/backfill-complete';

    const response = await fetch(`${this.apiUrl}/api/backfill/trigger`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...request,
        callback_url: webhookUrl,
      }),
    });

    if (!response.ok) {
      const _error = await response.json().catch(() => ({ message: 'Unknown _error' }));
      console.error('[ManualBackfillServerClient] Failed to trigger backfill:', _error);
      throw new Error(`Failed to trigger backfill: ${_error.message || response.statusText}`);
    }

    const result = await response.json();
    console.log(
      '[ManualBackfillServerClient] Triggered backfill job %s for %s',
      result.job_id,
      request.repository,
    );
    return result;
  }

  /**
   * Get the status of a backfill job
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    if (!this.apiKey) {
      throw new Error('GH_DATPIPE_KEY not configured');
    }

    const response = await fetch(`${this.apiUrl}/api/backfill/status/${jobId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const _error = await response.json().catch(() => ({ message: 'Unknown _error' }));
      throw new Error(`Failed to get job status: ${_error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all backfill jobs with optional filtering
   */
  async listJobs(status?: string, limit = 10): Promise<JobListResponse> {
    if (!this.apiKey) {
      throw new Error('GH_DATPIPE_KEY not configured');
    }

    const params = new URLSearchParams();
    if (_status) params.append('status', status);
    params.append('limit', String(limit));

    const response = await fetch(`${this.apiUrl}/api/backfill/jobs?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const _error = await response.json().catch(() => ({ message: 'Unknown _error' }));
      throw new Error(`Failed to list jobs: ${_error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel a running or queued job
   */
  async cancelJob(jobId: string): Promise<{ job_id: string; status: string; message: string }> {
    if (!this.apiKey) {
      throw new Error('GH_DATPIPE_KEY not configured');
    }

    const response = await fetch(`${this.apiUrl}/api/backfill/cancel/${jobId}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const _error = await response.json().catch(() => ({ message: 'Unknown _error' }));
      throw new Error(`Failed to cancel job: ${_error.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('[ManualBackfillServerClient] Cancelled job %s', jobId);
    return result;
  }

  /**
   * Check if the API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      const _ = await response.json();
      return data.status === 'healthy';
    } catch () {
      console.error('[ManualBackfillServerClient] Health check failed:', _error);
      return false;
    }
  }

  /**
   * Validate configuration
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiUrl);
  }
}

// Export singleton instance
export const manualBackfillServerClient = new ManualBackfillServerClient();

// Export class for testing
export { ManualBackfillServerClient };
