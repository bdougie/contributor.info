import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { TimeRangeContext, useTimeRange } from '../time-range';

describe('TimeRangeContext and useTimeRange', () => {
  it('should have the correct default values', () => {
    expect(TimeRangeContext.Provider).toBeDefined();

    const { result } = renderHook(() => useTimeRange());
    expect(result.current.timeRange).toBe('30');
    expect(result.current.setTimeRange).toEqual(expect.any(Function));
  });

  it('should return the context values via useTimeRange hook', () => {
    const mockSetTimeRange = vi.fn();
    const mockContextValue = { timeRange: '90', setTimeRange: mockSetTimeRange };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(TimeRangeContext.Provider, { value: mockContextValue }, children);

    const { result } = renderHook(() => useTimeRange(), { wrapper });
    expect(result.current).toEqual(mockContextValue);
  });
});
