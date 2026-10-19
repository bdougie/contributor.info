/**
 * Fly Machines API client for gh-datapipe (Deno edge-function version of
 * netlify/functions/lib/fly-machines.mts).
 *
 * Env: FLY_DATAPIPE_TOKEN, FLY_DATAPIPE_IMAGE, optional FLY_DATAPIPE_APP
 * (default gh-datapipe-sync) and FLY_DATAPIPE_REGION (default iad).
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
}

export interface CreateMachineOptions {
  name?: string;
  cmd: string[];
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
  const token = Deno.env.get('FLY_DATAPIPE_TOKEN');
  const image = Deno.env.get('FLY_DATAPIPE_IMAGE');
  if (!token || !image) return null;
  return {
    token,
    image,
    app: Deno.env.get('FLY_DATAPIPE_APP') || 'gh-datapipe-sync',
    region: Deno.env.get('FLY_DATAPIPE_REGION') || 'iad',
  };
}

export function isFlyConfigured(): boolean {
  return getFlyConfig() !== null;
}

function requireConfig(): FlyConfig {
  const config = getFlyConfig();
  if (!config) {
    throw new FlyMachinesError(
      'Fly datapipe not configured: set FLY_DATAPIPE_TOKEN and FLY_DATAPIPE_IMAGE',
      503,
    );
  }
  return config;
}

async function flyRequest<T>(
  config: FlyConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
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
      throw new FlyMachinesError(
        `Fly Machines API ${method} ${path} failed with ${response.status}${
          text ? `: ${text}` : ''
        }`,
        response.status,
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

/** Create and start a one-shot machine (auto_destroy, restart policy no). */
export function createMachine(options: CreateMachineOptions): Promise<FlyMachine> {
  const config = requireConfig();
  return flyRequest<FlyMachine>(config, 'POST', '/machines', {
    name: options.name ?? `capture-${Date.now()}`,
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

export async function startMachine(machineId: string): Promise<void> {
  const config = requireConfig();
  await flyRequest<Record<string, unknown>>(
    config,
    'POST',
    `/machines/${encodeURIComponent(machineId)}/start`,
  );
}

export async function destroyMachine(machineId: string): Promise<void> {
  const config = requireConfig();
  await flyRequest<Record<string, unknown>>(
    config,
    'DELETE',
    `/machines/${encodeURIComponent(machineId)}?force=true`,
  );
}
