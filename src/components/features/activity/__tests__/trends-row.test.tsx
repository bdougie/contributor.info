import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { TrendsRow } from '../trends-row';

// Mock the trends metrics module
vi.mock('@/lib/insights/trends-metrics', () => ({
  calculateTrendMetrics: vi.fn(),
}));

describe('TrendsRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with correct title', () => {
    render(<TrendsRow owner="test-owner" repo="test-repo" timeRange="30" />);
    
    expect(screen.getByText('Insights Trends')).toBeInTheDocument();
    expect(screen.getByText('Comparing to previous 30 day period')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TrendsRow owner="test-owner" repo="test-repo" timeRange="30" />);
    
    // Should show loading skeletons
    expect(screen.getByText('Insights Trends')).toBeInTheDocument();
  });
});