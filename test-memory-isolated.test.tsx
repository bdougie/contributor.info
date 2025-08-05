import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LastUpdated } from '@/components/ui/last-updated';

describe('Memory Leak Isolation Test', () => {
  it('should not accumulate memory with multiple renders', () => {
    const iterations = 100;
    const memoryBefore = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < iterations; i++) {
      const { unmount } = render(<LastUpdated timestamp="2024-01-15T10:00:00Z" />);
      unmount();
      cleanup();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = (memoryAfter - memoryBefore) / 1024 / 1024; // Convert to MB
    
    console.log(`Memory delta after ${iterations} renders: ${memoryDelta.toFixed(2)} MB`);
    
    // Memory increase should be minimal (less than 10MB for 100 renders)
    expect(memoryDelta).toBeLessThan(10);
  });
  
  it('should not accumulate script tags', () => {
    const iterations = 50;
    
    for (let i = 0; i < iterations; i++) {
      const { unmount } = render(<LastUpdated timestamp="2024-01-15T10:00:00Z" />);
      unmount();
    }
    
    cleanup();
    
    // Check that script tags are cleaned up
    const scriptTags = document.querySelectorAll('script[type="application/ld+json"]');
    expect(scriptTags.length).toBe(0);
  });
});