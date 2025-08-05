import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LastUpdated, LastUpdatedTime } from '../last-updated';

// Mock the time formatter hook
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn((date) => {
      const now = new Date('2024-01-15T12:00:00Z');
      const timestamp = typeof date === 'string' ? new Date(date) : date;
      const diffInHours = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60));
      if (diffInHours < 1) return 'Just now';
      if (diffInHours === 1) return '1 hour ago';
      return `${diffInHours} hours ago`;
    }),
    formatDate: vi.fn((date) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    })
  })
}));

// Mock console.warn to test error handling
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('LastUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('renders with Date object timestamp', () => {
    const timestamp = new Date('2024-01-15T11:00:00Z');
    render(<LastUpdated timestamp={timestamp} />);
    
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
  });

  it('uses custom label', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} label="Data refreshed" />);
    
    expect(screen.getByText(/Data refreshed:/)).toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} showIcon={false} />);
    
    // Clock icon should not be present
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} className="custom-class" />);
    
    const container = screen.getByRole('status');
    expect(container).toHaveClass('custom-class');
  });

  it('renders time element with correct datetime attribute', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} />);
    
    const timeElement = screen.getByText('2 hours ago');
    expect(timeElement.tagName).toBe('TIME');
    expect(timeElement).toHaveAttribute('dateTime', '2024-01-15T10:00:00.000Z');
  });

  it('includes structured data by default', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).toBeInTheDocument();
    
    const structuredData = JSON.parse(scriptElement?.textContent || '{}');
    expect(structuredData).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "dateModified": "2024-01-15T10:00:00.000Z"
    });
  });

  it('excludes structured data when includeStructuredData is false', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} includeStructuredData={false} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).not.toBeInTheDocument();
  });

  it('handles invalid timestamp gracefully', () => {
    render(<LastUpdated timestamp="invalid-date" />);
    
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      'LastUpdated: Invalid timestamp provided:', 
      'invalid-date'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    
    const { rerender } = render(<LastUpdated timestamp={timestamp} size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('text-xs');
    
    rerender(<LastUpdated timestamp={timestamp} size="md" />);
    expect(screen.getByRole('status')).toHaveClass('text-sm');
    
    rerender(<LastUpdated timestamp={timestamp} size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('text-base');
  });

  it('has proper accessibility attributes', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} />);
    
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-label', 'Last updated 2 hours ago');
  });
});

describe('LastUpdatedTime', () => {
  it('renders without label and icon', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdatedTime timestamp={timestamp} />);
    
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('does not include structured data', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdatedTime timestamp={timestamp} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).not.toBeInTheDocument();
  });
});