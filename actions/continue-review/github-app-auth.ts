import * as core from '@actions/core';
import * as github from '@actions/github';

/**
 * Get authenticated Octokit instance
 * This expects the token to be a GitHub App installation token generated
 * by actions/create-github-app-token in the workflow
 */
export async function getAuthenticatedOctokit(
  githubToken: string
): Promise<ReturnType<typeof github.getOctokit>> {
  // Validate that we have a token
  if (!githubToken) {
    throw new Error(
      'GitHub token is required. Please provide a token from actions/create-github-app-token or GITHUB_TOKEN'
    );
  }

  core.info('Using provided GitHub token for API calls');

  // The token should already be an App installation token if the workflow
  // is configured correctly with actions/create-github-app-token
  return github.getOctokit(githubToken);
}
