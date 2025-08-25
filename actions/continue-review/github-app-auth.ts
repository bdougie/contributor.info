import * as core from '@actions/core';
import * as github from '@actions/github';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { getEmbeddedAppConfig } from './app-config-encrypted';

/**
 * Create an authenticated Octokit instance using embedded GitHub App credentials
 */
export async function createAppOctokit(
  owner: string,
  repo: string
): Promise<ReturnType<typeof github.getOctokit> | null> {
  // Get embedded App configuration
  const config = getEmbeddedAppConfig();
  
  if (!config) {
    core.info('No embedded Continue Agent App configuration available');
    return null;
  }

  try {
    // Create app authentication
    const auth = createAppAuth({
      appId: config.appId,
      privateKey: config.privateKey,
    });

    // Get installation ID for this repository
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
      },
    });

    // Find the installation for this repository
    const { data: installation } = await appOctokit.apps.getRepoInstallation({
      owner,
      repo,
    });

    if (!installation) {
      core.warning(`Continue Agent App is not installed on ${owner}/${repo}`);
      return null;
    }

    core.info(`Found Continue Agent App installation ID: ${installation.id}`);

    // Create installation access token
    const installationAuth = await auth({
      type: 'installation',
      installationId: installation.id,
    });

    // Create authenticated Octokit instance with installation token
    const octokit = github.getOctokit(installationAuth.token);
    
    core.info('Successfully authenticated as Continue Agent App');
    return octokit;
  } catch (error) {
    core.warning(`Failed to authenticate as Continue Agent App: ${error}`);
    return null;
  }
}

/**
 * Get authenticated Octokit instance - tries App auth first, falls back to token
 */
export async function getAuthenticatedOctokit(
  githubToken: string,
  owner: string,
  repo: string
): Promise<ReturnType<typeof github.getOctokit>> {
  // Try embedded Continue Agent App authentication first
  const appOctokit = await createAppOctokit(owner, repo);
  if (appOctokit) {
    core.info('Using Continue Agent App for GitHub API calls');
    return appOctokit;
  }

  // Fall back to regular token authentication
  core.info('Using provided GitHub token for API calls');
  return github.getOctokit(githubToken);
}