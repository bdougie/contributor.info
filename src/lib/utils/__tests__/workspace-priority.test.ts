import { describe, it, expect } from 'vitest';
import { getWorkspacePriority } from '../workspace-priority';

describe('getWorkspacePriority', () => {
  it('should return 10 for enterprise tier', () => {
    expect(getWorkspacePriority('enterprise')).toBe(10);
  });

  it('should return 50 for pro tier', () => {
    expect(getWorkspacePriority('pro')).toBe(50);
  });

  it('should return 100 for free tier', () => {
    expect(getWorkspacePriority('free')).toBe(100);
  });

  it('should return 100 for any other tier', () => {
    expect(getWorkspacePriority('basic')).toBe(100);
    expect(getWorkspacePriority('starter')).toBe(100);
    expect(getWorkspacePriority('custom')).toBe(100);
    expect(getWorkspacePriority('')).toBe(100);
  });
});
