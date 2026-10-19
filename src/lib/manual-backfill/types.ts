/**
 * Manual backfill API types shared by the ManualBackfill UI and the Netlify
 * functions (`netlify/functions/backfill-*.mts`). The server side of these
 * shapes is `netlify/functions/lib/datapipe-jobs.mts`.
 */

export type BackfillJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackfillRequest {
  repository: string;
  days?: number;
  sources?: string[];
}

export interface BackfillResponse {
  job_id: string;
  status: BackfillJobStatus;
  repository: string;
  days: number;
  estimated_completion: string;
  status_url: string;
  fly_machine_id: string | null;
}

export interface JobStatus {
  id: string;
  status: BackfillJobStatus;
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
