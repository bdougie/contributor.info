import { describe, it, expect, vi } from 'vitest';
import { TimeRangeContext, useTimeRange } from '../time-range';
import * as React from 'react';

// Mock React's useContext hook
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: vi.fn()
  };
});

describe('TimeRangeContext and useTimeRange', () => {
  it('should have the correct default values', () => {
    // Test the context's default values directly
    expect(TimeRangeContext.Provider).toBeDefined();
    expect(TimeRangeContext._currentValue).toEqual({
      timeRange: '30',
      setTimeRange: expect.any(Function),
    });
  });
  
  it('should return the context values via useTimeRange hook', () => {
    // Mock the useContext hook
    const mockContextValue = { timeRange: '90', setTimeRange: vi.fn() };
    
    // Set up the mock return value for useContext
    vi.mocked(React.useContext).mockReturnValue(mockContextValue);
    
    // Call the hook and verify it returns the context value
    const result = useTimeRange();
    expect(result).toEqual(mockContextValue);
    expect(React.useContext).toHaveBeenCalledWith(TimeRangeContext);
  });
});