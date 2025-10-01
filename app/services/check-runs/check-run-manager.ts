import type { Octokit } from '@octokit/rest';

/**
 * GitHub Check Run API wrapper types
 */
export interface CheckRunUpdate {
  status?: 'queued' | 'in_progress' | 'completed';
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required';
  completed_at?: string;
  output?: CheckRunOutput;
}

export interface CheckRunOutput {
  title: string;
  summary: string;
  text?: string;
  annotations?: CheckRunAnnotation[];
}

export interface CheckRunAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
}

/**
 * CheckRunManager - Reusable GitHub Check Runs API wrapper
 *
 * Provides a clean interface for creating and updating GitHub Check Runs,
 * used by both similarity and performance checks.
 */
export class CheckRunManager {
  constructor(
    private octokit: Octokit,
    private owner: string,
    private repo: string,
    private headSha: string
  ) {}

  /**
   * Create a new Check Run
   */
  async create(params: {
    name: string;
    head_sha: string;
    status?: 'queued' | 'in_progress' | 'completed';
  }): Promise<number> {
    try {
      const { data: checkRun } = await this.octokit.rest.checks.create({
        owner: this.owner,
        repo: this.repo,
        name: params.name,
        head_sha: params.head_sha,
        status: params.status || 'in_progress',
      });

      console.log('Created Check Run: %s (ID: %s)', params.name, checkRun.id);

      return checkRun.id;
    } catch (error) {
      console.error('Error creating Check Run: %o', error);
      throw error;
    }
  }

  /**
   * Update an existing Check Run
   */
  async update(checkRunId: number, params: CheckRunUpdate): Promise<void> {
    try {
      await this.octokit.rest.checks.update({
        owner: this.owner,
        repo: this.repo,
        check_run_id: checkRunId,
        status: params.status,
        conclusion: params.conclusion,
        completed_at: params.completed_at,
        output: params.output
          ? {
              title: params.output.title,
              summary: params.output.summary,
              text: params.output.text,
              // GitHub limits to 50 annotations, handle undefined/null safely
              annotations: params.output.annotations
                ? params.output.annotations.slice(0, 50)
                : undefined,
            }
          : undefined,
      });

      console.log('Updated Check Run ID: %s', checkRunId);
    } catch (error) {
      console.error('Error updating Check Run: %o', error);
      throw error;
    }
  }

  /**
   * Complete a Check Run with success
   */
  async complete(
    checkRunId: number,
    conclusion: 'success' | 'neutral' | 'failure',
    summary: string
  ): Promise<void> {
    await this.update(checkRunId, {
      status: 'completed',
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: 'Check Complete',
        summary,
      },
    });
  }

  /**
   * Fail a Check Run with error details
   */
  async fail(checkRunId: number, summary: string): Promise<void> {
    await this.update(checkRunId, {
      status: 'completed',
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: 'Check Failed',
        summary,
      },
    });
  }

  /**
   * Add annotations to a Check Run (for warnings/errors)
   */
  async addAnnotations(checkRunId: number, annotations: CheckRunAnnotation[]): Promise<void> {
    try {
      // GitHub API allows updating annotations by updating the check run
      // We'll need to get current output and merge annotations
      const { data: checkRun } = await this.octokit.rest.checks.get({
        owner: this.owner,
        repo: this.repo,
        check_run_id: checkRunId,
      });

      if (checkRun.output) {
        await this.update(checkRunId, {
          output: {
            title: checkRun.output.title || 'Check Run',
            summary: checkRun.output.summary || '',
            text: checkRun.output.text,
            annotations: annotations.slice(0, 50), // GitHub limits to 50
          },
        });
      }
    } catch (error) {
      console.error('Error adding annotations to Check Run: %o', error);
      throw error;
    }
  }
}
