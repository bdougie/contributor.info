import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressiveChart } from './ProgressiveChart';

// Mock IntersectionObserver
const observe = vi.fn();
const disconnect = vi.fn();
const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
  observe,
  disconnect,
  takeRecords: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

global.IntersectionObserver = mockIntersectionObserver;

describe('ProgressiveChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not re-create IntersectionObserver on re-renders with default options', () => {
    const { rerender } = render(
      <ProgressiveChart skeleton={<div>Skeleton</div>} highFidelity={<div>High Fidelity</div>} />
    );

    // Initial render should create observer
    expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);

    // Force re-render
    rerender(
      <ProgressiveChart skeleton={<div>Skeleton</div>} highFidelity={<div>High Fidelity</div>} />
    );

    // Should not create another observer because options should be stable
    expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
  });
});
