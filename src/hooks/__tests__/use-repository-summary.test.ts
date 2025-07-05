import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useRepositorySummary } from '@/hooks/use-repository-summary';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }
  }
}));

describe('useRepositorySummary', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => 
      useRepositorySummary('facebook', 'react', [])
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.summary).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should not fetch when owner or repo is undefined', () => {
    const { result } = renderHook(() => 
      useRepositorySummary(undefined, undefined, [])
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.summary).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(() => 
      useRepositorySummary('facebook', 'react', [])
    );

    expect(typeof result.current.refetch).toBe('function');
  });
});