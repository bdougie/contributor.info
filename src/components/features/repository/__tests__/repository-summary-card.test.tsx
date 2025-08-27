import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RepositorySummaryCard } from '@/components/features/repository/repository-summary-card';

// Mock the hook with simpler implementation
vi.mock('@/hooks/use-repository-summary', () => ({
  useRepositorySummary: vi.fn(() => ({
    summary: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

describe('RepositorySummaryCard', () => {
  it('should render without crashing', () => {
    const { container } = render(<RepositorySummaryCard owner="facebook" repo="react" />);
    expect(container).toBeDefined();
  });
});
