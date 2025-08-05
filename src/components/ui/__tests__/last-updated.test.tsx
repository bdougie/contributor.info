import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('LastUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up React Testing Library renders
    cleanup();
    // Clean up any script tags added by structured data
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      script.remove();
    });
    // Clear all mocks after each test
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

  it('includes structured data by default with secure implementation', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).toBeInTheDocument();
    
    // The textContent should be set via ref, not dangerouslySetInnerHTML
    expect(scriptElement?.textContent).toBeTruthy();
    
    if (scriptElement?.textContent) {
      const structuredData = JSON.parse(scriptElement.textContent);
      expect(structuredData).toEqual({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "dateModified": "2024-01-15T10:00:00.000Z"
      });
    }
  });

  it('excludes structured data when includeStructuredData is false', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    render(<LastUpdated timestamp={timestamp} includeStructuredData={false} />);
    
    const scriptElement = document.querySelector('script[type="application/ld+json"]');
    expect(scriptElement).not.toBeInTheDocument();
  });

  it('handles invalid timestamp gracefully', () => {
    render(<LastUpdated timestamp="invalid-date" />);
    
    expect(console.warn).toHaveBeenCalledWith(
      'LastUpdated: Invalid or unsafe timestamp provided:', 
      'invalid-date'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('handles potentially malicious timestamp input', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    render(<LastUpdated timestamp={maliciousInput} />);
    
    // Should detect suspicious patterns and warn about malicious input
    expect(console.warn).toHaveBeenCalledWith(
      'LastUpdated: Potentially malicious input detected:', 
      maliciousInput
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('rejects timestamps outside reasonable range', () => {
    // Test far future date (2050 is more than 10 years from test date 2024)
    const farFuture = '2050-01-01T00:00:00Z';
    render(<LastUpdated timestamp={farFuture} />);
    
    expect(console.warn).toHaveBeenCalledWith(
      'LastUpdated: Timestamp outside reasonable range:', 
      farFuture
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('detects and rejects various XSS attempts', () => {
    const xssAttempts = [
      'javascript:alert(1)',
      '<img onload="alert(1)">',
      'onclick="alert(1)"',
      '<iframe src="javascript:alert(1)"></iframe>'
    ];

    xssAttempts.forEach(attempt => {
      vi.mocked(console.warn).mockClear();
      const { unmount } = render(<LastUpdated timestamp={attempt} />);
      
      expect(console.warn).toHaveBeenCalledWith(
        'LastUpdated: Potentially malicious input detected:', 
        attempt
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      
      // Clean up after each render to prevent memory accumulation
      unmount();
    });
  });

  it('accepts valid timestamps within reasonable range', () => {
    const validTimestamps = [
      '2024-01-15T10:00:00Z',
      '2023-12-25T15:30:00.000Z',
      new Date('2024-06-01'),
      '2025-01-01' // Just within the 10-year future limit
    ];

    validTimestamps.forEach(timestamp => {
      vi.mocked(console.warn).mockClear();
      const { unmount } = render(<LastUpdated timestamp={timestamp} />);
      
      expect(console.warn).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    });
  });

  it('applies correct size classes', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    
    const { rerender, unmount } = render(<LastUpdated timestamp={timestamp} size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('text-xs');
    
    rerender(<LastUpdated timestamp={timestamp} size="md" />);
    expect(screen.getByRole('status')).toHaveClass('text-sm');
    
    rerender(<LastUpdated timestamp={timestamp} size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('text-base');
    
    // Clean up after rerenders
    unmount();
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