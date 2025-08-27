import { supabase } from '../supabase';
import { env } from '../env';
import { jobStatusReporter } from './job-status-reporter';

export interface GitHubActionsJobInput {
  workflow: string;
  inputs: {
    repository_id: string;
    repository_name: string;
    time_range?: string;
    max_items?: string;
    job_id?: string;
    [key: string]: string | undefined;
  };
}

export class GitHubActionsQueueManager {
  private readonly GITHUB_TOKEN = env.GITHUB_TOKEN;
  private readonly REPO_OWNER = 'bdougie';
  private readonly REPO_NAME = 'contributor.info';

  /**
   * Dispatch a workflow to GitHub Actions
   */
  async dispatchWorkflow(
    job: GitHubActionsJobInput
  ): Promise<{ success: boolean; runId?: number; error?: string }> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/actions/workflows/${job.workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: job.inputs,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[GitHubActions] Workflow dispatch failed:', error);
        return { success: false, error };
      }

      // GitHub Actions API doesn't return the run ID directly, but we can track it
      // through the job_id in our database
      console.log('[GitHubActions] Workflow %s dispatched successfully', job.workflow);

      // Record the job in our tracking table
      if (job.inputs.job_id) {
        await this.recordJobDispatch(job.inputs.job_id, job.workflow);

        // Report status via the reporter service
        await jobStatusReporter.reportStatus({
          jobId: job.inputs.job_id,
          status: 'processing',
          metadata: {
            workflow: job.workflow,
            dispatched_at: new Date().toISOString(),
            github_api_response: 'success',
          },
        });
      }

      return { success: true };
    } catch (error) {
      console.error('[GitHubActions] Error dispatching workflow:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Record that a job was dispatched to GitHub Actions
   */
  private async recordJobDispatch(jobId: string, workflow: string): Promise<void> {
    try {
      await supabase
        .from('progressive_capture_jobs')
        .update({
          processor_type: 'github_actions',
          status: 'processing',
          started_at: new Date().toISOString(),
          metadata: supabase.rpc('jsonb_merge', {
            target: 'metadata',
            source: JSON.stringify({ workflow, dispatched_at: new Date().toISOString() }),
          }),
        })
        .eq('id', jobId);
    } catch (error) {
      console.error('[GitHubActions] Error recording job dispatch:', error);
    }
  }

  /**
   * Check the status of GitHub Actions jobs
   */
  async checkJobStatuses(): Promise<void> {
    try {
      // Get all processing GitHub Actions jobs
      const { data: processingJobs } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('processor_type', 'github_actions')
        .eq('status', 'processing')
        .gte('started_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()); // Within last 6 hours

      if (!processingJobs || processingJobs.length === 0) {
        return;
      }

      // For each job, check if we can find its workflow run
      for (const job of processingJobs) {
        await this.checkJobStatus(job);
      }
    } catch (error) {
      console.error('[GitHubActions] Error checking job statuses:', error);
    }
  }

  /**
   * Check the status of a specific job
   */
  private async checkJobStatus(job: any): Promise<void> {
    try {
      // Query workflow runs to find our job
      const response = await fetch(
        `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/actions/runs?created=>=${job.started_at}`,
        {
          headers: {
            Authorization: `Bearer ${this.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      // Try to find a run that matches our job
      // This is a heuristic - in production, you might want to pass a unique identifier
      const matchingRun = data.workflow_runs.find((run: any) => {
        const runTime = new Date(run.created_at).getTime();
        const jobTime = new Date(job.started_at).getTime();
        return Math.abs(runTime - jobTime) < 60000; // Within 1 minute
      });

      if (matchingRun) {
        const status = this.mapGitHubStatusToJobStatus(matchingRun.status, matchingRun.conclusion);

        // Use the job status reporter for consistent updates
        await jobStatusReporter.reportStatus({
          jobId: job.id,
          status: status,
          workflowRunId: matchingRun.id,
          workflowRunUrl: matchingRun.html_url,
          metadata: {
            github_status: matchingRun.status,
            github_conclusion: matchingRun.conclusion,
            run_url: matchingRun.html_url,
            run_number: matchingRun.run_number,
            attempt: matchingRun.run_attempt,
          },
        });

        // Calculate metrics if completed
        if (status === 'completed' || status === 'failed') {
          await jobStatusReporter.calculateMetrics(job.id);
        }
      }
    } catch (error) {
      console.error(`[GitHubActions] Error checking status for job ${job.id}:`, error);
    }
  }

  /**
   * Map GitHub Actions status to our job status
   */
  private mapGitHubStatusToJobStatus(
    status: string,
    conclusion: string | null
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    if (status === 'completed') {
      switch (conclusion) {
        case 'success':
          return 'completed';
        case 'failure':
        case 'cancelled':
        case 'timed_out':
          return 'failed';
        default:
          return 'processing';
      }
    }
    return 'processing';
  }

  /**
   * Get statistics for GitHub Actions jobs
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const { data } = await supabase
        .from('progressive_capture_jobs')
        .select('status')
        .eq('processor_type', 'github_actions')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (!data) {
        return { pending: 0, processing: 0, completed: 0, failed: 0 };
      }

      return data.reduce(
        (acc, job) => {
          const status = job.status as keyof typeof acc;
          if (status in acc) {
            acc[status]++;
          }
          return acc;
        },
        { pending: 0, processing: 0, completed: 0, failed: 0 }
      );
    } catch (error) {
      console.error('[GitHubActions] Error getting stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }
}

// Export singleton instance
export const githubActionsQueueManager = new GitHubActionsQueueManager();
