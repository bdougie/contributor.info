#!/usr/bin/env node

import { program } from 'commander';
import { GitHubIssueReporter } from './lib/github-issue-reporter.js';
import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
program
  .option('--job-type <type>', 'Type of job that failed')
  .option('--repository-id <id>', 'Repository ID being processed')
  .option('--repository-name <name>', 'Repository name (owner/name format)')
  .option('--workflow-name <name>', 'GitHub Actions workflow name')
  .option('--workflow-url <url>', 'URL to the workflow run')
  .option('--error-message <message>', 'Error message from the failure')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Get repository name if not provided
    let repositoryName = options.repositoryName;

    if (!repositoryName && options.repositoryId) {
      repositoryName = await getRepositoryName(options.repositoryId);
    }

    if (!repositoryName) {
      console.error('Could not determine repository name');
      process.exit(1);
    }

    // Get error message from GitHub Actions context if not provided
    const errorMessage =
      options.errorMessage ||
      process.env.GITHUB_JOB_ERROR ||
      'Job failed without specific error message';

    // Prepare job details
    const jobDetails = {
      jobType: options.jobType || 'unknown',
      repositoryName,
      workflowName: options.workflowName || process.env.GITHUB_WORKFLOW || 'Unknown Workflow',
      workflowUrl:
        options.workflowUrl ||
        `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      errorMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        repository_id: options.repositoryId,
        run_id: process.env.GITHUB_RUN_ID,
        run_number: process.env.GITHUB_RUN_NUMBER,
        run_attempt: process.env.GITHUB_RUN_ATTEMPT,
        actor: process.env.GITHUB_ACTOR,
        event_name: process.env.GITHUB_EVENT_NAME,
        ref: process.env.GITHUB_REF,
        sha: process.env.GITHUB_SHA,
      },
    };

    // Create issue reporter
    const token = process.env.GITHUB_TOKEN;
    const repository = process.env.GITHUB_REPOSITORY;

    if (!token || !repository) {
      throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required');
    }

    const [owner, repo] = repository.split('/');
    const reporter = new GitHubIssueReporter(token, owner, repo);

    // Report the failure
    const issue = await reporter.reportFailedJob(jobDetails);

    console.log(`✅ Failure reported successfully`);
    console.log(`   Issue: ${issue.html_url}`);
  } catch (error) {
    console.error('❌ Error reporting failure:', error);
    // Don't fail the workflow if issue reporting fails
    process.exit(0);
  }
}

async function getRepositoryName(repositoryId) {
  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from('repositories')
      .select('owner, name')
      .eq('id', repositoryId)
      .single();

    if (error || !data) {
      return null;
    }

    return `${data.owner}/${data.name}`;
  } catch (error) {
    console.error('Error fetching repository name:', error);
    return null;
  }
}

// Run the script
main();
