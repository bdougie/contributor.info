/**
 * GitHub App installation tokens for server-side sync of private repositories.
 *
 * The shared GITHUB_TOKEN PAT can only see public repositories. Private repos
 * are opted in by installing the contributor.info GitHub App, and sync must
 * authenticate with that installation's token instead.
 *
 * Uses Web Crypto (crypto.subtle) rather than node:crypto so this module is
 * safe in every bundle we produce (Vite client build, Netlify functions,
 * Deno edge functions) — in the browser the token paths are never executed
 * because supabase-admin resolves to null there.
 */
import { supabaseAdmin } from '../supabase-admin';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToBase64url(input: string): string {
  return bytesToBase64url(new TextEncoder().encode(input));
}

function decodeBase64Env(value: string): string {
  try {
    return atob(value.replace(/\s/g, ''));
  } catch {
    // Value wasn't base64 — assume it's the raw PEM
    return value;
  }
}

function getAppCredentials(): { appId: string; privateKey: string } | null {
  const appId = process.env.CONTRIBUTOR_APP_ID || process.env.GITHUB_APP_ID || '';

  let privateKey = process.env.CONTRIBUTOR_APP_KEY || '';
  if (!privateKey && process.env.GITHUB_APP_PRIVATE_KEY_ENCODED) {
    privateKey = decodeBase64Env(process.env.GITHUB_APP_PRIVATE_KEY_ENCODED);
  }
  if (!privateKey && process.env.GITHUB_APP_PRIVATE_KEY) {
    privateKey = decodeBase64Env(process.env.GITHUB_APP_PRIVATE_KEY);
  }

  if (!appId || !privateKey) {
    return null;
  }
  return { appId, privateKey };
}

/** Minimal DER length encoding for the PKCS#8 wrapper below */
function derLength(length: number): number[] {
  if (length < 0x80) {
    return [length];
  }
  const bytes: number[] = [];
  let n = length;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

/**
 * Wrap a PKCS#1 RSA private key (GitHub's PEM format, "BEGIN RSA PRIVATE
 * KEY") in a PKCS#8 envelope, which is the only format crypto.subtle can
 * import: SEQUENCE { INTEGER 0, SEQUENCE { rsaEncryption OID, NULL },
 * OCTET STRING { pkcs1 } }
 */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = [0x02, 0x01, 0x00];
  const rsaAlgorithmId = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ];
  const octetStringHeader = [0x04, ...derLength(pkcs1.length)];
  const contentLength =
    version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1.length;

  return new Uint8Array([
    0x30,
    ...derLength(contentLength),
    ...version,
    ...rsaAlgorithmId,
    ...octetStringHeader,
    ...pkcs1,
  ]);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  const der = base64ToBytes(pem.replace(/-----[^-]+-----/g, ''));
  const pkcs8 = isPkcs1 ? pkcs1ToPkcs8(der) : der;

  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function generateAppJWT(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat backdated 60s to allow for clock drift, 10 minute expiry (GitHub max)
  const payload = stringToBase64url(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }));

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  return `${header}.${payload}.${bytesToBase64url(new Uint8Array(signature))}`;
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

  const jwt = await generateAppJWT(credentials.appId, credentials.privateKey);
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
