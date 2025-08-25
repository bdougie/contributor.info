import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadRules } from './rules';
import { generateReview } from './continue-client';
import { postReview } from './github-client';
import type { PullRequest, ReviewContext } from './types';

const execAsync = promisify(exec);

async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const continueApiKey = core.getInput('continue-api-key', { required: true });
    const continueOrg = core.getInput('continue-org', { required: true });
    const continueConfig = core.getInput('continue-config', { required: true });

    // Get context
    const context = github.context;
    const { owner, repo } = context.repo;
    
    core.info(`Repository: ${owner}/${repo}`);
    core.info(`Event: ${context.eventName}`);

    // Determine PR number
    let prNumber: number | undefined;
    
    if (context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request?.number;
    } else if (context.eventName === 'issue_comment') {
      prNumber = context.payload.issue?.number;
      
      // Only process if it's a PR comment with @continue-agent
      if (!context.payload.issue?.pull_request) {
        core.info('Not a pull request comment, skipping');
        return;
      }
      
      const comment = context.payload.comment?.body || '';
      if (!comment.includes('@continue-agent')) {
        core.info('Comment does not mention @continue-agent, skipping');
        return;
      }
    }

    if (!prNumber) {
      throw new Error('Could not determine pull request number');
    }

    core.info(`Processing PR #${prNumber}`);

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken);

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get PR diff
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    // Load rules
    const rules = await loadRules(files.map(f => f.filename));
    core.info(`Loaded ${rules.length} applicable rules`);

    // Extract command from comment if present
    let command: string | undefined;
    if (context.eventName === 'issue_comment') {
      const commentBody = context.payload.comment?.body || '';
      command = extractCommand(commentBody);
    }

    // Create review context
    const reviewContext: ReviewContext = {
      pr: {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: pr.user?.login || 'unknown',
        files: files.map(f => ({
          filename: f.filename,
          patch: f.patch || '',
          additions: f.additions,
          deletions: f.deletions,
        })),
      },
      rules,
      command,
      repository: `${owner}/${repo}`,
    };

    // Post initial progress comment
    const progressCommentId = await postReview(
      octokit,
      owner,
      repo,
      prNumber,
      '🔄 **Review in progress...**\\n\\nI\\'m analyzing the changes in this pull request. This may take a moment.',
      true, // isProgress
    );

    // Generate review using Continue
    const review = await generateReview(
      reviewContext,
      continueConfig,
      continueApiKey,
    );

    // Post final review
    await postReview(
      octokit,
      owner,
      repo,
      prNumber,
      review,
      false, // isProgress
      progressCommentId,
    );

    core.info('Review completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

function extractCommand(comment: string): string | undefined {
  const match = comment.match(/@continue-agent\\s+(.+)/);
  return match ? match[1].trim() : undefined;
}

// Run the action
run();