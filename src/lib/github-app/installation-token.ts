/**
 * GitHub App installation tokens for server-side sync of private repositories.
 *
 * The shared GITHUB_TOKEN PAT can only see public repositories. Private repos
 * are opted in by installing the contributor.info GitHub App, and sync must
 * authenticate with that installation's token instead. This module is
 * server-only (Inngest/Netlify functions) — it uses node:crypto to sign the
 * app JWT so it adds no dependencies.
 */
import { createSign } from 'node:crypto';
import { supabaseAdmin } from '../supabase-admin';

function base64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getAppCredentials(): { appId: string; privateKey: string } | null {
  const appId = process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID || '';

  let privateKey = process.env.CONTRIBUTOR_APP_KEY || '';
  if (!privateKey && process.env.GITHUB_APP_PRIVATE_KEY_ENCODED) {
    privateKey = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_ENCODED, 'base64').toString();
  }
  if (!privateKey && process.env.GITHUB_APP_PRIVATE_KEY) {
    privateKey = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY, 'base64').toString();
  }

  if (!appId || !privateKey) {
    return null;
  }
  return { appId, privateKey };
}

function generateAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat backdated 60s to allow for clock drift, 10 minute expiry (GitHub max)
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }));
  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey)
  );
  return `${header}.${payload}.${signature}`;
}

// Installation tokens are valid for 1 hour; cache with a safety margin
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const credentials = getAppCredentials();
  if (!credentials) {
    throw new Error(
      'GitHub App credentials not configured (CONTRIBUTOR_APP_ID / CONTRIBUTOR_APP_KEY)'
    );
  }

  const jwt = generateAppJWT(credentials.appId, credentials.privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'contributor-info',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to create installation token for installation ${installationId}: ${response.status} ${body}`
    );
  }

  const data = (await response.json()) as { token: string; expires_at: string };
  tokenCache.set(installationId, {
    token: data.token,
    // Refresh 5 minutes before GitHub's expiry
    expiresAt: new Date(data.expires_at).getTime() - 5 * 60 * 1000,
  });

  return data.token;
}

/**
 * Find the GitHub App installation covering a repository (by database id).
 * Checks the explicit app_enabled_repositories link first, then falls back
 * to an owner-wide installation with repository_selection = 'all'.
 */
export async function getInstallationIdForRepo(repositoryId: string): Promise<number | null> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available');
  }

  const { data: enabledRepo } = await supabaseAdmin
    .from('app_enabled_repositories')
    .select('github_app_installations!inner(installation_id, deleted_at, suspended_at)')
    .eq('repository_id', repositoryId)
    .is('github_app_installations.deleted_at', null)
    .is('github_app_installations.suspended_at', null)
    .maybeSingle();

  const installation = Array.isArray(enabledRepo?.github_app_installations)
    ? enabledRepo?.github_app_installations[0]
    : enabledRepo?.github_app_installations;

  if (installation?.installation_id) {
    return installation.installation_id;
  }

  const { data: repo } = await supabaseAdmin
    .from('repositories')
    .select('owner')
    .eq('id', repositoryId)
    .maybeSingle();

  if (repo?.owner) {
    const { data: ownerInstall } = await supabaseAdmin
      .from('github_app_installations')
      .select('installation_id')
      .eq('account_name', repo.owner)
      .eq('repository_selection', 'all')
      .is('deleted_at', null)
      .is('suspended_at', null)
      .maybeSingle();

    if (ownerInstall?.installation_id) {
      return ownerInstall.installation_id;
    }
  }

  return null;
}

/**
 * Resolve the GitHub token to use for syncing a repository.
 * Public repos return undefined so callers keep using the shared PAT;
 * private repos get an installation token (or an error if the app was
 * uninstalled — the shared PAT cannot see them, so there is no fallback).
 */
export async function getTokenForRepo(repository: {
  id: string;
  is_private?: boolean | null;
}): Promise<string | undefined> {
  if (!repository.is_private) {
    return undefined;
  }

  const installationId = await getInstallationIdForRepo(repository.id);
  if (!installationId) {
    throw new Error(
      `Private repository ${repository.id} has no active GitHub App installation — install the contributor.info app to sync it`
    );
  }

  return getInstallationToken(installationId);
}
