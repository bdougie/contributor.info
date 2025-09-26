#!/usr/bin/env node

import { Octokit } from '@octokit/rest';

/**
 * GitHub Issue Reporter - Creates and updates issues for failed data capture jobs
 */
export class GitHubIssueReporter {
  constructor(token, owner, repo) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
    this.maintainer = 'bdougie';
  }

  /**
   * Report a failed job by creating or updating a GitHub issue
   * @param {Object} jobDetails - Details about the failed job
   * @returns {Promise<Object>} The created or updated issue
   */
  async reportFailedJob(jobDetails) {
    const {
      jobType,
      repositoryName,
      workflowName,
      workflowUrl,
      errorMessage,
      timestamp,
      metadata = {},
    } = jobDetails;

    try {
      // Search for existing open issue
      const existingIssue = await this.findExistingIssue(repositoryName, jobType);

      if (existingIssue) {
        // Update existing issue with new failure
        return await this.updateIssue(existingIssue, jobDetails);
      } else {
        // Create new issue
        return await this.createIssue(jobDetails);
      }
    } catch (error) {
      console.error('Error reporting to GitHub:', error);
      throw error;
    }
  }

  /**
   * Find existing open issue for the same repository and job type
   */
  async findExistingIssue(repositoryName, jobType) {
    try {
      const query = `repo:${this.owner}/${this.repo} is:issue is:open in:title "${repositoryName}" "${jobType}"`;

      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: query,
        sort: 'created',
        order: 'desc',
        per_page: 1,
      });

      return data.items.length > 0 ? data.items[0] : null;
    } catch (error) {
      console.error('Error searching for existing issue:', error);
      return null;
    }
  }

  /**
   * Create a new issue for failed job
   */
  async createIssue(jobDetails) {
    const {
      jobType,
      repositoryName,
      workflowName,
      workflowUrl,
      errorMessage,
      timestamp,
      metadata = {},
    } = jobDetails;

    const title = `Data Capture Failed: ${repositoryName} - ${jobType}`;

    const body = `## Data Capture Failure Report

@${this.maintainer} - A data capture job has failed and needs attention.

### Job Details
- **Repository**: ${repositoryName}
- **Job Type**: ${jobType}
- **Workflow**: ${workflowName}
- **Failed At**: ${new Date(timestamp).toLocaleString()}
- **Workflow Run**: ${workflowUrl}

### Error Details
\`\`\`
${errorMessage}
\`\`\`

### Additional Context
${this.formatMetadata(metadata)}

### Failure History
- First failure: ${new Date(timestamp).toLocaleString()}
- Total failures: 1

---
*This issue was automatically created by the GitHub Actions failure reporter.*
`;

    try {
      const { data } = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels: ['bug', 'data-capture-failure', 'automated'],
      });

      console.log(`Created issue #${data.number}: ${data.html_url}`);
      return data;
    } catch (error) {
      console.error('Error creating issue:', error);
      throw error;
    }
  }

  /**
   * Update existing issue with new failure information
   */
  async updateIssue(issue, jobDetails) {
    const { workflowName, workflowUrl, errorMessage, timestamp, metadata = {} } = jobDetails;

    // Extract failure count from issue body
    const failureCountMatch = issue.body.match(/Total failures: (\d+)/);
    const currentFailures = failureCountMatch ? parseInt(failureCountMatch[1]) : 1;
    const newFailureCount = currentFailures + 1;

    const comment = `## Another Failure Occurred

@${this.maintainer} - The same job has failed again.

### Latest Failure Details
- **Workflow**: ${workflowName}
- **Failed At**: ${new Date(timestamp).toLocaleString()}
- **Workflow Run**: ${workflowUrl}
- **Failure #**: ${newFailureCount}

### Error Details
\`\`\`
${errorMessage}
\`\`\`

### Additional Context
${this.formatMetadata(metadata)}

---
*This comment was automatically added by the GitHub Actions failure reporter.*
`;

    try {
      // Add comment
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issue.number,
        body: comment,
      });

      // Update issue body to reflect new failure count
      const updatedBody = issue.body.replace(
        /Total failures: \d+/,
        `Total failures: ${newFailureCount}`
      );

      await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issue.number,
        body: updatedBody,
      });

      console.log(`Updated issue #${issue.number}: ${issue.html_url}`);
      return issue;
    } catch (error) {
      console.error('Error updating issue:', error);
      throw error;
    }
  }

  /**
   * Format metadata object for display
   */
  formatMetadata(metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '*No additional metadata*';
    }

    return Object.entries(metadata)
      .map(([key, value]) => `- **${this.formatKey(key)}**: ${this.formatValue(value)}`)
      .join('\n');
  }

  /**
   * Format metadata key for display
   */
  formatKey(key) {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format metadata value for display
   */
  formatValue(value) {
    if (typeof value === 'object') {
      return `\`${JSON.stringify(value, null, 2)}\``;
    }
    return value;
  }

  /**
   * Close an issue when the job starts working again
   */
  async closeIssueIfFixed(repositoryName, jobType) {
    try {
      const existingIssue = await this.findExistingIssue(repositoryName, jobType);

      if (existingIssue) {
        const comment = `## Job Successfully Completed ✅

The data capture job is now working correctly. Closing this issue.

---
*This comment was automatically added by the GitHub Actions failure reporter.*
`;

        await this.octokit.issues.createComment({
          owner: this.owner,
          repo: this.repo,
          issue_number: existingIssue.number,
          body: comment,
        });

        await this.octokit.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: existingIssue.number,
          state: 'closed',
        });

        console.log(`Closed issue #${existingIssue.number} as fixed`);
      }
    } catch (error) {
      console.error('Error closing fixed issue:', error);
    }
  }
}

// Export a function to be used in GitHub Actions
export async function reportFailure(jobDetails) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required');
  }

  const [owner, repo] = repository.split('/');
  const reporter = new GitHubIssueReporter(token, owner, repo);

  return await reporter.reportFailedJob(jobDetails);
}
