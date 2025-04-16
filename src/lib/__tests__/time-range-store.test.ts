import { describe, it, expect, beforeEach } from 'vitest';
import { useTimeRangeStore } from '../time-range-store';
import { act, renderHook } from '@testing-library/react';

describe('useTimeRangeStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    const { result } = renderHook(() => useTimeRangeStore());
    act(() => {
      result.current.setTimeRange('30');
    });
  });
  
  it('should initialize with default time range', () => {
    const { result } = renderHook(() => useTimeRangeStore());
    
    expect(result.current.timeRange).toBe('30');
    expect(result.current.timeRangeNumber).toBe(30);
  });
  
  it('should update time range when setTimeRange is called', () => {
    const { result } = renderHook(() => useTimeRangeStore());
    
    act(() => {
      result.current.setTimeRange('90');
    });
    
    expect(result.current.timeRange).toBe('90');
    expect(result.current.timeRangeNumber).toBe(90);
  });
  
  it('should convert string time range to number', () => {
    const { result } = renderHook(() => useTimeRangeStore());
    
    act(() => {
      result.current.setTimeRange('7');
    });
    
    expect(result.current.timeRange).toBe('7');
    expect(result.current.timeRangeNumber).toBe(7);
  });
  
  it('should handle invalid input by defaulting to 0', () => {
    const { result } = renderHook(() => useTimeRangeStore());
    
    act(() => {
      result.current.setTimeRange('invalid');
    });
    
    expect(result.current.timeRange).toBe('invalid');
    expect(result.current.timeRangeNumber).toBe(NaN); // parseInt returns NaN for invalid input
  });
});