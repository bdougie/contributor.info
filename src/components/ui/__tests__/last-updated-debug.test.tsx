import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LastUpdated } from '../last-updated';

// Mock the time formatter hook
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn(() => '2 hours ago'),
    formatDate: vi.fn(() => 'Jan 15, 2024')
  })
}));

describe('LastUpdated Debug', () => {
  let mockConsoleWarn: any;
  
  beforeEach(() => {
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      console.log('CONSOLE.WARN CALLED WITH:', args);
    });
  });
  
  it('should log for invalid date', () => {
    console.log('=== Testing invalid-date ===');
    
    const result = render(<LastUpdated timestamp="invalid-date" />);
    
    console.log('Component rendered, checking console.warn calls...');
    console.log('Number of warn calls:', mockConsoleWarn.mock.calls.length);
    console.log('All warn calls:', mockConsoleWarn.mock.calls);
    
    // This should have been called
    expect(mockConsoleWarn).toHaveBeenCalled();
  });
});