import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useTimeFormatter } from '../use-time-formatter';

describe('useTimeFormatter', () => {
  beforeAll(() => {
    // Mock the Date object to have a fixed value for consistent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-05-15T12:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });
  
  afterEach(() => {
    cleanup();
  });

  it('should format relative time correctly', () => {
    const { result } = renderHook(() => useTimeFormatter());
    
    // Just now (less than a minute ago)
    expect(result.current.formatRelativeTime('2023-05-15T11:59:30Z')).toBe('Just now');
    
    // Minutes ago
    expect(result.current.formatRelativeTime('2023-05-15T11:45:00Z')).toBe('15 minutes ago');
    
    // Hours ago
    expect(result.current.formatRelativeTime('2023-05-15T09:00:00Z')).toBe('3 hours ago');
    
    // Days ago
    expect(result.current.formatRelativeTime('2023-05-10T12:00:00Z')).toBe('5 days ago');
    
    // Months ago
    expect(result.current.formatRelativeTime('2023-01-15T12:00:00Z')).toBe('4 months ago');
    
    // Years ago
    expect(result.current.formatRelativeTime('2021-05-15T12:00:00Z')).toBe('2 years ago');
  });

  it('should format date correctly', () => {
    const { result } = renderHook(() => useTimeFormatter());
    
    // Default format
    expect(result.current.formatDate('2023-05-15T12:00:00Z')).toMatch(/May 15, 2023/);
    
    // Custom format
    expect(result.current.formatDate('2023-05-15T12:00:00Z', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })).toMatch(/May 15, 2023/);
  });

  it('should format time correctly', () => {
    const { result } = renderHook(() => useTimeFormatter());
    
    // The exact format will depend on locale, so we use partial matching
    const formattedTime = result.current.formatTime('2023-05-15T14:30:00Z');
    expect(formattedTime).toContain('30');
  });

  it('should format date range correctly', () => {
    const { result } = renderHook(() => useTimeFormatter());
    
    // Same year
    const sameYearRange = result.current.formatDateRange(
      '2023-03-15T12:00:00Z',
      '2023-05-15T12:00:00Z'
    );
    expect(sameYearRange).toMatch(/Mar 15.+May 15, 2023/);
    
    // Different years
    const differentYearRange = result.current.formatDateRange(
      '2022-10-15T12:00:00Z',
      '2023-05-15T12:00:00Z'
    );
    expect(differentYearRange).toMatch(/Oct 15, 2022.+May 15, 2023/);
  });

  it('should get time difference correctly', () => {
    const { result } = renderHook(() => useTimeFormatter());
    
    // Seconds
    expect(result.current.getTimeDifference('2023-05-15T11:59:30Z')).toBe('30 seconds');
    
    // Minutes
    expect(result.current.getTimeDifference('2023-05-15T11:45:00Z')).toBe('15 minutes');
    
    // Hours
    expect(result.current.getTimeDifference('2023-05-15T09:00:00Z')).toBe('3 hours');
    
    // Days
    expect(result.current.getTimeDifference('2023-05-10T12:00:00Z')).toBe('5 days');
    
    // Months
    expect(result.current.getTimeDifference('2023-01-15T12:00:00Z')).toBe('4 months');
    
    // Years
    expect(result.current.getTimeDifference('2021-05-15T12:00:00Z')).toBe('2 years');
    
    // With explicit end date
    expect(result.current.getTimeDifference(
      '2023-05-10T12:00:00Z',
      '2023-05-15T12:00:00Z'
    )).toBe('5 days');
  });
});