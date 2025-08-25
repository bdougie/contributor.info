import * as core from '@actions/core';
import * as github from '@actions/github';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

interface AppConfig {
  appId: number;
  privateKey: string;
}

/**
 * Get GitHub App configuration from environment or embedded values
 */
export function getAppConfig(): AppConfig | null {
  // Option 1: Check for environment variables (for testing/development)
  if (process.env.CONTINUE_APP_ID && process.env.CONTINUE_APP_PRIVATE_KEY) {
    core.info('Using GitHub App credentials from environment variables');
    return {
      appId: parseInt(process.env.CONTINUE_APP_ID, 10),
      privateKey: process.env.CONTINUE_APP_PRIVATE_KEY,
    };
  }

  // Option 2: Try to load from embedded config file (created during build)
  try {
    const configPath = new URL('.app-config.json', import.meta.url).pathname;
    const config = require(configPath);
    if (config.appId && config.privateKey) {
      core.info('Using embedded GitHub App credentials from config file');
      return {
        appId: config.appId,
        privateKey: config.privateKey,
      };
    }
  } catch (error) {
    // Config file doesn't exist or is invalid
    core.debug('No embedded App config file found');
  }

  // Option 3: Use hardcoded credentials (least secure, but works)
  // You can replace these with your actual Continue Review App credentials
  // For production, use the build script to inject these securely
  const EMBEDDED_APP_ID = process.env.EMBEDDED_APP_ID || ''; // Set during build
  const EMBEDDED_PRIVATE_KEY = process.env.EMBEDDED_PRIVATE_KEY || ''; // Set during build

  if (EMBEDDED_APP_ID && EMBEDDED_PRIVATE_KEY) {
    core.info('Using embedded GitHub App credentials');
    return {
      appId: parseInt(EMBEDDED_APP_ID, 10),
      privateKey: EMBEDDED_PRIVATE_KEY,
    };
  }

  return null;
}

/**
 * Create an authenticated Octokit instance using GitHub App
 */
export async function createAppOctokit(
  owner: string,
  repo: string,
  appConfig?: AppConfig
): Promise<ReturnType<typeof github.getOctokit> | null> {
  const config = appConfig || getAppConfig();
  
  if (!config) {
    core.info('No GitHub App configuration available');
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
      core.warning(`GitHub App is not installed on ${owner}/${repo}`);
      return null;
    }

    core.info(`Found GitHub App installation ID: ${installation.id}`);

    // Create installation access token
    const installationAuth = await auth({
      type: 'installation',
      installationId: installation.id,
    });

    // Create authenticated Octokit instance with installation token
    const octokit = github.getOctokit(installationAuth.token);
    
    core.info('Successfully authenticated as GitHub App');
    return octokit;
  } catch (error) {
    core.warning(`Failed to authenticate as GitHub App: ${error}`);
    return null;
  }
}

/**
 * Get authenticated Octokit instance - tries App auth first, falls back to token
 */
export async function getAuthenticatedOctokit(
  githubToken: string,
  owner: string,
  repo: string,
  preferApp: boolean = true
): Promise<ReturnType<typeof github.getOctokit>> {
  if (preferApp) {
    // Try GitHub App authentication first
    const appOctokit = await createAppOctokit(owner, repo);
    if (appOctokit) {
      core.info('Using GitHub App authentication for API calls');
      return appOctokit;
    }
  }

  // Fall back to regular token authentication
  core.info('Using GitHub token authentication for API calls');
  return github.getOctokit(githubToken);
}