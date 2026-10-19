import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('fly-machines', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    process.env.FLY_DATAPIPE_TOKEN = 'fly-token';
    process.env.FLY_DATAPIPE_IMAGE = 'registry.fly.io/gh-datapipe-sync:test';
    delete process.env.FLY_DATAPIPE_APP;
    delete process.env.FLY_DATAPIPE_REGION;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('is not configured without token and image', async () => {
    delete process.env.FLY_DATAPIPE_TOKEN;
    const fly = await import('../fly-machines.mts');
    expect(fly.isConfigured()).toBe(false);
    await expect(fly.startMachine('m1')).rejects.toMatchObject({ status: 503 });
  });

  it('createMachine posts an auto_destroy machine with the command', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'abc123', name: 'backfill-1', state: 'created', region: 'iad' }),
    });

    const fly = await import('../fly-machines.mts');
    const machine = await fly.createMachine({
      name: 'backfill-1',
      cmd: ['python', 'scripts/unified_workspace_backfill.py', '--job-id', 'j1'],
      env: { JOB_ID: 'j1' },
    });

    expect(machine.id).toBe('abc123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.machines.dev/v1/apps/gh-datapipe-sync/machines');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fly-token');
    const body = JSON.parse(init.body);
    expect(body.config.auto_destroy).toBe(true);
    expect(body.config.restart.policy).toBe('no');
    expect(body.config.image).toBe('registry.fly.io/gh-datapipe-sync:test');
    expect(body.config.init.cmd).toEqual([
      'python',
      'scripts/unified_workspace_backfill.py',
      '--job-id',
      'j1',
    ]);
    expect(body.config.env).toEqual({ JOB_ID: 'j1' });
    expect(body.config.guest).toEqual({ cpu_kind: 'shared', cpus: 2, memory_mb: 4096 });
  });

  it('surfaces the Fly status code on failure', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'bad token' });

    const fly = await import('../fly-machines.mts');
    await expect(fly.startMachine('m1')).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('bad token'),
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.machines.dev/v1/apps/gh-datapipe-sync/machines/m1/start'
    );
  });

  it('getMachine returns null on 404 and destroyMachine forces deletion', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const fly = await import('../fly-machines.mts');
    expect(await fly.getMachine('gone')).toBeNull();
    await fly.destroyMachine('m2');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.machines.dev/v1/apps/gh-datapipe-sync/machines/m2?force=true');
    expect(init.method).toBe('DELETE');
  });

  it('maps network errors to 502', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const fly = await import('../fly-machines.mts');
    await expect(fly.startMachine('m1')).rejects.toMatchObject({ status: 502 });
  });
});
