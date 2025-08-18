/**
 * Manual Backfill API Client
 * 
 * This module provides functions to interact with the gh-datapipe manual backfill API
 */

export interface BackfillRequest {
  repository: string;
  days?: number;
  force?: boolean;
  callback_url?: string;
}

export interface BackfillResponse {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  repository: string;
  days: number;
  estimated_completion: string;
  status_url: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  data: {
    repository: string;
    days: number;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface JobListResponse {
  jobs: JobStatus[];
  count: number;
  timestamp: string;
}

class ManualBackfillClient {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    // Use server-side environment variables for API configuration
    this.apiUrl = process.env.GH_DATPIPE_API_URL || 'https://gh-datapipe.fly.dev';
    this.apiKey = process.env.GH_DATPIPE_KEY || '';
    
    if (!this.apiKey) {
      console.warn('GH_DATPIPE_KEY not configured. Manual backfill will not work.');
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
    const response = await fetch(`${this.apiUrl}/api/backfill/trigger`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...request,
        callback_url: request.callback_url || `${window.location.origin}/api/webhook/backfill-complete`,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to trigger backfill: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the status of a backfill job
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
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
    const response = await fetch(`${this.apiUrl}/api/backfill/cancel/${jobId}`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to cancel job: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create an EventSource for real-time job updates
   */
  createEventSource(): EventSource {
    // EventSource doesn't support custom headers, so we'll append the API key as a query parameter
    // Note: This is less secure than headers, but EventSource limitations require it
    const url = new URL(`${this.apiUrl}/api/backfill/events`);
    url.searchParams.append('api_key', this.apiKey);
    
    return new EventSource(url.toString());
  }

  /**
   * Check if the API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const manualBackfillClient = new ManualBackfillClient();

// Export types for use in components
export type { ManualBackfillClient };