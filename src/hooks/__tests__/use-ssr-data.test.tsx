import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { useSSRData, useWorkspaceDetailSSRData, useWorkspacesSSRData } from '../use-ssr-data';

type SSRWindow = Window & { __SSR_DATA__?: unknown };

function setSSRData(route: string, ageMs = 0) {
  (window as SSRWindow).__SSR_DATA__ = {
    route,
    data: { marker: route },
    timestamp: Date.now() - ageMs,
  };
}

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
}

describe('useSSRData route keys', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
  });

  afterEach(() => {
    delete (window as SSRWindow).__SSR_DATA__;
    vi.unstubAllGlobals();
  });

  it('matches the workspace detail payload by its fixed key, not the pathname', () => {
    setSSRData('workspace-detail');
    const { result } = renderHook(() => useWorkspaceDetailSSRData(), {
      wrapper: wrapperAt('/i/platform-team'),
    });
    expect(result.current).toEqual({ marker: 'workspace-detail' });
  });

  it('matches the workspaces list payload by its fixed key', () => {
    setSSRData('workspaces');
    const { result } = renderHook(() => useWorkspacesSSRData(), {
      wrapper: wrapperAt('/workspaces'),
    });
    expect(result.current).toEqual({ marker: 'workspaces' });
  });

  it('falls back to the pathname when no key is given', () => {
    setSSRData('/acme/api');
    const { result } = renderHook(() => useSSRData(), { wrapper: wrapperAt('/acme/api') });
    expect(result.current).toEqual({ marker: '/acme/api' });
  });

  it('returns null when the key does not match', () => {
    setSSRData('workspace-detail');
    const { result } = renderHook(() => useSSRData(300, 'workspaces'), {
      wrapper: wrapperAt('/i/platform-team'),
    });
    expect(result.current).toBeNull();
  });

  it('accepts a workspace detail payload up to an hour old', () => {
    setSSRData('workspace-detail', 45 * 60 * 1000);
    const { result } = renderHook(() => useWorkspaceDetailSSRData(), {
      wrapper: wrapperAt('/i/platform-team'),
    });
    expect(result.current).toEqual({ marker: 'workspace-detail' });
  });

  it('rejects a payload older than the max age', () => {
    setSSRData('workspaces', 10 * 60 * 1000);
    const { result } = renderHook(() => useWorkspacesSSRData(), {
      wrapper: wrapperAt('/workspaces'),
    });
    expect(result.current).toBeNull();
  });
});
