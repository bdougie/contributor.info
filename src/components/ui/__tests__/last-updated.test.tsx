import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LastUpdated, LastUpdatedTime } from '../last-updated';

// Simple mock for the time formatter hook
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: () => '2 hours ago',
    formatDate: () => 'Jan 15, 2024, 10:00 AM'
  })
}));

describe('LastUpdated', () => {
  it('renders with default props', () => {
    render(<LastUpdated timestamp="2024-01-15T10:00:00Z" />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('handles invalid timestamp gracefully', () => {
    render(<LastUpdated timestamp="invalid-date" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('excludes structured data when specified', () => {
    render(<LastUpdated timestamp="2024-01-15T10:00:00Z" includeStructuredData={false} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).not.toBeInTheDocument();
  });
});

describe('LastUpdatedTime', () => {
  it('renders without label and icon', () => {
    render(<LastUpdatedTime timestamp="2024-01-15T10:00:00Z" />);
    
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });
});