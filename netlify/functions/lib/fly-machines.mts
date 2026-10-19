/**
 * Fly Machines API client for gh-datapipe.
 *
 * Every on-demand backfill is one Fly machine on the process-less
 * `gh-datapipe-sync` app: created with `auto_destroy`, it runs
 * `unified_workspace_backfill.py --job-id <id>` and is gone when the command
 * exits. Job state lives in Supabase (`datapipe_jobs`), never on the machine.
 *
 * Env:
 *   FLY_DATAPIPE_TOKEN  deploy token scoped to gh-datapipe-sync (required)
 *   FLY_DATAPIPE_IMAGE  registry.fly.io/gh-datapipe-sync:<tag>, printed by
 *                       gh-datapipe/scripts/deploy-to-fly.sh (required)
 *   FLY_DATAPIPE_APP    app name, default gh-datapipe-sync
 *   FLY_DATAPIPE_REGION region, default iad
 */

const FLY_API_BASE = 'https://api.machines.dev/v1';
const REQUEST_TIMEOUT_MS = 15_000;

export interface FlyConfig {
  token: string;
  image: string;
  app: string;
  region: string;
}

export interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id?: string;
}

export interface CreateMachineOptions {
  /** Machine name shown in `fly machines list`. Defaults to `backfill-<ts>`. */
  name?: string;
  /** Command passed to docker-entrypoint.sh, e.g. ['python', 'scripts/...'] */
  cmd: string[];
  /** Extra env for this run (JOB_ID, etc.). Secrets come from the app. */
  env?: Record<string, string>;
  cpus?: number;
  memoryMb?: number;
}

export class FlyMachinesError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FlyMachinesError';
    this.status = status;
  }
}

export function getFlyConfig(): FlyConfig | null {
  const token = process.env.FLY_DATAPIPE_TOKEN;
  const image = process.env.FLY_DATAPIPE_IMAGE;
  if (!token || !image) return null;
  return {
    token,
    image,
    app: process.env.FLY_DATAPIPE_APP || 'gh-datapipe-sync',
    region: process.env.FLY_DATAPIPE_REGION || 'iad',
  };
}

export function isConfigured(): boolean {
  return getFlyConfig() !== null;
}

function requireConfig(): FlyConfig {
  const config = getFlyConfig();
  if (!config) {
    throw new FlyMachinesError(
      'Fly datapipe not configured: set FLY_DATAPIPE_TOKEN and FLY_DATAPIPE_IMAGE',
      503
    );
  }
  return config;
}

async function flyRequest<T>(
  config: FlyConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FLY_API_BASE}/apps/${config.app}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[fly-machines] %s %s returned %d: %s', method, path, response.status, text);
      throw new FlyMachinesError(
        `Fly Machines API ${method} ${path} failed with ${response.status}${text ? `: ${text}` : ''}`,
        response.status
      );
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof FlyMachinesError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new FlyMachinesError(`Fly Machines API ${method} ${path} failed: ${message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create and start a one-shot machine. `auto_destroy` removes it once the
 * command exits; `restart.policy = 'no'` keeps a failing command from looping.
 */
export async function createMachine(options: CreateMachineOptions): Promise<FlyMachine> {
  const config = requireConfig();
  const name = options.name ?? `backfill-${Date.now()}`;

  return flyRequest<FlyMachine>(config, 'POST', '/machines', {
    name,
    region: config.region,
    config: {
      image: config.image,
      env: options.env ?? {},
      auto_destroy: true,
      restart: { policy: 'no' },
      guest: {
        cpu_kind: 'shared',
        cpus: options.cpus ?? 2,
        memory_mb: options.memoryMb ?? 4096,
      },
      init: { cmd: options.cmd },
    },
  });
}

/** Start an existing stopped machine (the scheduler machines use this). */
export async function startMachine(machineId: string): Promise<void> {
  const config = requireConfig();
  await flyRequest<Record<string, unknown>>(
    config,
    'POST',
    `/machines/${encodeURIComponent(machineId)}/start`
  );
}

/** Stop and delete a machine. Used by backfill-cancel. */
export async function destroyMachine(machineId: string): Promise<void> {
  const config = requireConfig();
  await flyRequest<Record<string, unknown>>(
    config,
    'DELETE',
    `/machines/${encodeURIComponent(machineId)}?force=true`
  );
}

/** Fetch a machine, or null when Fly no longer knows it (auto-destroyed). */
export async function getMachine(machineId: string): Promise<FlyMachine | null> {
  const config = requireConfig();
  try {
    return await flyRequest<FlyMachine>(
      config,
      'GET',
      `/machines/${encodeURIComponent(machineId)}`
    );
  } catch (error) {
    if (error instanceof FlyMachinesError && error.status === 404) return null;
    throw error;
  }
}
