import { describe, it, expect } from 'vitest';
import { getRoutePattern } from '../route-pattern';

describe('getRoutePattern', () => {
  it('returns static routes as-is', () => {
    expect(getRoutePattern('/')).toBe('/');
    expect(getRoutePattern('/trending')).toBe('/trending');
    expect(getRoutePattern('/workspaces')).toBe('/workspaces');
    expect(getRoutePattern('/login')).toBe('/login');
    expect(getRoutePattern('/privacy/data-request')).toBe('/privacy/data-request');
  });

  it('normalizes trailing slashes', () => {
    expect(getRoutePattern('/trending/')).toBe('/trending');
    expect(getRoutePattern('/continuedev/continue/')).toBe('/:owner/:repo');
  });

  it('maps repo views to /:owner/:repo', () => {
    expect(getRoutePattern('/continuedev/continue')).toBe('/:owner/:repo');
    expect(getRoutePattern('/facebook/react')).toBe('/:owner/:repo');
  });

  it('maps repo sub-tabs to /:owner/:repo/<tab>', () => {
    expect(getRoutePattern('/continuedev/continue/health')).toBe('/:owner/:repo/health');
    expect(getRoutePattern('/facebook/react/feed')).toBe('/:owner/:repo/feed');
    expect(getRoutePattern('/facebook/react/distribution')).toBe('/:owner/:repo/distribution');
    expect(getRoutePattern('/facebook/react/widgets')).toBe('/:owner/:repo/widgets');
  });

  it('maps workspace routes to their patterns', () => {
    expect(getRoutePattern('/workspace/abc-123')).toBe('/workspace/:id');
    expect(getRoutePattern('/workspace/abc-123/settings')).toBe('/workspace/:id/:tab');
    expect(getRoutePattern('/workspaces/new')).toBe('/workspaces/new');
    expect(getRoutePattern('/workspace/new')).toBe('/workspace/new');
  });

  it('maps invitation tokens to /invitation/:token', () => {
    expect(getRoutePattern('/invitation/some-opaque-token')).toBe('/invitation/:token');
  });

  it('maps single-segment paths to /:username', () => {
    expect(getRoutePattern('/bdougie')).toBe('/:username');
  });

  it('keeps dev and admin routes as-is', () => {
    expect(getRoutePattern('/admin/users')).toBe('/admin/users');
    expect(getRoutePattern('/dev/social-cards')).toBe('/dev/social-cards');
  });

  it('falls back to the raw pathname for unknown shapes', () => {
    expect(getRoutePattern('/a/b/c/d')).toBe('/a/b/c/d');
    expect(getRoutePattern('/owner/repo/not-a-tab')).toBe('/owner/repo/not-a-tab');
  });
});
