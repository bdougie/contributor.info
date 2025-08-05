import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LastUpdated } from './src/components/ui/last-updated';

// Mock the time formatter hook
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn(() => '2 hours ago'),
    formatDate: vi.fn(() => 'Jan 15, 2024')
  })
}));

describe('LastUpdated Minimal Test', () => {
  let mockConsoleWarn;
  
  beforeEach(() => {
    // Create fresh mock for each test
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      console.log('CONSOLE.WARN CALLED WITH:', args);
    });
  });
  
  it('should call console.warn for invalid timestamp', () => {
    console.log('=== Starting test ===');
    
    // Call the validation function directly first
    const { validateTimestamp } = require('./src/components/ui/last-updated');
    const result = validateTimestamp('invalid-date');
    console.log('validateTimestamp result:', result);
    
    // Now render the component
    render(<LastUpdated timestamp="invalid-date" />);
    
    console.log('Mock calls:', mockConsoleWarn.mock.calls);
    console.log('Mock call count:', mockConsoleWarn.mock.calls.length);
    
    expect(mockConsoleWarn).toHaveBeenCalled();
  });
});