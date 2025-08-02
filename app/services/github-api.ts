import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getPrivateKey } from '../../netlify/functions/utils/get-private-key.mts';

// Initialize Octokit instance
let octokit: Octokit;

/**
 * Get authenticated Octokit instance
 */
async function getOctokit(): Promise<Octokit> {
  if (octokit) {
    return octokit;
  }

  const privateKey = await getPrivateKey();
  
  if (privateKey && process.env.GITHUB_APP_ID) {
    // Use GitHub App authentication
    octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(process.env.GITHUB_APP_ID),
        privateKey,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID 
          ? parseInt(process.env.GITHUB_APP_INSTALLATION_ID)
          : undefined,
      },
    });
  } else if (process.env.GITHUB_TOKEN) {
    // Fallback to personal access token
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  } else {
    throw new Error('No GitHub authentication method available');
  }

  return octokit;
}

/**
 * Create a comment on an issue
 */
export async function createIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  try {
    const octokit = await getOctokit();
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    
    console.log(`Posted comment on issue #${issueNumber} in ${owner}/${repo}`);
  } catch (error) {
    console.error('Error creating issue comment:', error);
    throw error;
  }
}

/**
 * Create a comment on a pull request
 */
export async function createPullRequestComment(
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<void> {
  try {
    const octokit = await getOctokit();
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
    
    console.log(`Posted comment on PR #${pullNumber} in ${owner}/${repo}`);
  } catch (error) {
    console.error('Error creating PR comment:', error);
    throw error;
  }
}

/**
 * Get issue details
 */
export async function getIssue(
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching issue:', error);
    throw error;
  }
}

/**
 * List issues for a repository
 */
export async function listRepositoryIssues(
  owner: string,
  repo: string,
  options: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    since?: string;
    per_page?: number;
    page?: number;
  } = {}
) {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: options.state || 'open',
      labels: options.labels,
      sort: options.sort || 'created',
      direction: options.direction || 'desc',
      since: options.since,
      per_page: options.per_page || 30,
      page: options.page || 1,
    });
    
    return data;
  } catch (error) {
    console.error('Error listing issues:', error);
    throw error;
  }
}