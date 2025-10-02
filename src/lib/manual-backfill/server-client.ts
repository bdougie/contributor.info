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
    this.apiUrl = process.env.GH_DATPIPE_API_URL || 'https://gh-datapipe-sync.fly.dev';
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

    const requestUrl = `${this.apiUrl}/api/backfill/trigger`;
    const requestPayload = {
      ...request,
      callback_url: webhookUrl,
    };

    console.log('[ManualBackfillServerClient] Initiating backfill request:', {
      url: requestUrl,
      repository: request.repository,
      days: request.days,
      hasApiKey: Boolean(this.apiKey),
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestPayload),
      });

      // Log response details for diagnostics
      console.log('[ManualBackfillServerClient] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        // Try to get detailed error information
        let errorDetails = { message: 'Unknown error' };
        const contentType = response.headers.get('content-type');

        try {
          if (contentType?.includes('application/json')) {
            errorDetails = await response.json();
          } else {
            const textError = await response.text();
            errorDetails = { message: textError || response.statusText };
          }
        } catch (parseError) {
          console.error('[ManualBackfillServerClient] Failed to parse error response:', parseError);
        }

        console.error('[ManualBackfillServerClient] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          repository: request.repository,
          url: requestUrl,
        });

        throw new Error(
          `Failed to trigger backfill: ${errorDetails.message || response.statusText}`
        );
      }

      const result = await response.json();
      console.log('[ManualBackfillServerClient] Success:', {
        job_id: result.job_id,
        repository: request.repository,
        status: result.status,
      });

      return result;
    } catch (error) {
      // Log fetch-level errors (network issues, etc.)
      console.error('[ManualBackfillServerClient] Fetch error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        repository: request.repository,
        url: requestUrl,
        apiUrl: this.apiUrl,
      });

      throw error;
    }
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
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to get job status: ${error.message || response.statusText}`);
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
    if (status) params.append('status', status);
    params.append('limit', String(limit));

    const response = await fetch(`${this.apiUrl}/api/backfill/jobs?${params}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to list jobs: ${error.message || response.statusText}`);
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
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to cancel job: ${error.message || response.statusText}`);
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
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('[ManualBackfillServerClient] Health check failed:', error);
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
