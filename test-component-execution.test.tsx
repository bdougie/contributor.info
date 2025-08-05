import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the hooks first
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn(() => '2 hours ago'),
    formatDate: vi.fn(() => 'Jan 15, 2024')
  })
}));

// Mock console globally
global.console = {
  ...console,
  warn: vi.fn((...args) => {
    console.log('[TEST] console.warn called with:', args);
  })
};

// Import after mocking
import { LastUpdated } from '@/components/ui/last-updated';

describe('Component Execution Test', () => {
  it('should execute and warn', () => {
    console.log('=== Test Start ===');
    
    const { container } = render(<LastUpdated timestamp="invalid-date" />);
    
    console.log('Rendered container:', container.innerHTML);
    console.log('console.warn calls:', (console.warn as any).mock?.calls);
    
    expect(console.warn).toHaveBeenCalled();
  });
});