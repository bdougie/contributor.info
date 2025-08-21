import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../sync-service';

// Mock the supabase client
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-id', is_tracked: true, size_class: 'small' },
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should determine if repository is large', () => {
    // Pure function test - no async
    const isLarge = SyncService['shouldUseSupabase'](
      'pytorch/pytorch',
      'large',
      {}
    );
    expect(isLarge).toBe(true);
  });

  it('should use Netlify for small repos', () => {
    const isLarge = SyncService['shouldUseSupabase'](
      'small/repo',
      'small',
      {}
    );
    expect(isLarge).toBe(false);
  });

  it('should respect forceSupabase option', () => {
    const forced = SyncService['shouldUseSupabase'](
      'any/repo',
      'small',
      { forceSupabase: true }
    );
    expect(forced).toBe(true);
  });

  it('should respect forceNetlify option', () => {
    const forced = SyncService['shouldUseSupabase'](
      'pytorch/pytorch',
      'large',
      { forceNetlify: true }
    );
    expect(forced).toBe(false);
  });

  it('should use Supabase for full syncs', () => {
    const fullSync = SyncService['shouldUseSupabase'](
      'any/repo',
      'small',
      { fullSync: true }
    );
    expect(fullSync).toBe(true);
  });

  it('should use Supabase for long date ranges', () => {
    const longRange = SyncService['shouldUseSupabase'](
      'any/repo',
      'small',
      { daysLimit: 100 }
    );
    expect(longRange).toBe(true);
  });
});