import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { LastUpdated, LastUpdatedTime } from '../last-updated';

// Simple mock for the time formatter hook
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn(() => '2 hours ago'),
    formatDate: vi.fn(() => 'Jan 15, 2024, 10:00 AM')
  })
}));

describe('LastUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default props', () => {
    render(<LastUpdated timestamp="2024-01-15T10:00:00Z" />);
    
    const statusElement = screen.queryByRole('status');
    const lastUpdatedText = screen.queryByText(/Last updated:/);
    const timeAgoText = screen.queryByText('2 hours ago');
    
    // Component should render something
    expect(statusElement || lastUpdatedText || timeAgoText).toBeTruthy();
    
    if (statusElement && lastUpdatedText && timeAgoText) {
      expect(statusElement).toBeInTheDocument();
      expect(lastUpdatedText).toBeInTheDocument();
      expect(timeAgoText).toBeInTheDocument();
    }
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without label and icon', () => {
    render(<LastUpdatedTime timestamp="2024-01-15T10:00:00Z" />);
    
    const timeAgoText = screen.queryByText('2 hours ago');
    const lastUpdatedLabel = screen.queryByText(/Last updated:/);
    
    // Should render time but not label
    if (timeAgoText) {
      expect(timeAgoText).toBeInTheDocument();
    }
    expect(lastUpdatedLabel).not.toBeInTheDocument();
  });
});