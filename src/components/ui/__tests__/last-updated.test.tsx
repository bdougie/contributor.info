import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LastUpdated, LastUpdatedTime } from '../last-updated';

// Create lightweight mocks to prevent memory accumulation
const mockFormatRelativeTime = vi.fn();
const mockFormatDate = vi.fn();

// Mock the time formatter hook with pre-defined responses
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: mockFormatRelativeTime,
    formatDate: mockFormatDate
  })
}));

describe('LastUpdated', () => {
  beforeEach(() => {
    // Clear all mocks and set up default responses
    vi.clearAllMocks();
    
    // Set up mock implementations with minimal memory footprint
    mockFormatRelativeTime.mockImplementation((date) => {
      const timestamp = typeof date === 'string' ? Date.parse(date) : date.getTime();
      const now = Date.parse('2024-01-15T12:00:00Z');
      const diffInHours = Math.floor((now - timestamp) / (1000 * 60 * 60));
      if (diffInHours < 1) return 'Just now';
      if (diffInHours === 1) return '1 hour ago';
      return `${diffInHours} hours ago`;
    });
    
    mockFormatDate.mockImplementation((date) => {
      const timestamp = typeof date === 'string' ? Date.parse(date) : date.getTime();
      return new Date(timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    });
  });
  
  afterEach(() => {
    // Clean up React Testing Library renders
    cleanup();
    
    // Clean up any script tags added by structured data
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      script.remove();
    });
    
    // Force garbage collection hints
    mockFormatRelativeTime.mockClear();
    mockFormatDate.mockClear();
    vi.clearAllMocks();
    
    // Clean up any timers or intervals
    vi.clearAllTimers();
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

    xssAttempts.forEach((attempt, index) => {
      // Clear console mock for each attempt
      vi.mocked(console.warn).mockClear();
      
      const { unmount } = render(<LastUpdated timestamp={attempt} />);
      
      expect(console.warn).toHaveBeenCalledWith(
        'LastUpdated: Potentially malicious input detected:', 
        attempt
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      
      // Immediate cleanup after each render
      unmount();
      cleanup();
      
      // Clean up any script tags created during this iteration
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        script.remove();
      });
      
      // Force mock cleanup every few iterations to prevent accumulation
      if (index % 2 === 1) {
        vi.clearAllMocks();
      }
    });
  });

  it('accepts valid timestamps within reasonable range', () => {
    const validTimestamps = [
      '2024-01-15T10:00:00Z',
      '2023-12-25T15:30:00.000Z',
      new Date('2024-06-01'),
      '2025-01-01' // Just within the 10-year future limit
    ];

    validTimestamps.forEach((timestamp, index) => {
      vi.mocked(console.warn).mockClear();
      
      const { unmount } = render(<LastUpdated timestamp={timestamp} />);
      
      expect(console.warn).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toBeInTheDocument();
      
      // Immediate cleanup
      unmount();
      cleanup();
      
      // Clean up script tags
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        script.remove();
      });
      
      // Force mock cleanup every few iterations
      if (index % 2 === 1) {
        vi.clearAllMocks();
      }
    });
  });

  it('applies correct size classes', () => {
    const timestamp = '2024-01-15T10:00:00Z';
    
    // Test each size individually to avoid rerender memory accumulation
    const { unmount: unmountSm } = render(<LastUpdated timestamp={timestamp} size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('text-xs');
    unmountSm();
    cleanup();
    
    const { unmount: unmountMd } = render(<LastUpdated timestamp={timestamp} size="md" />);
    expect(screen.getByRole('status')).toHaveClass('text-sm');
    unmountMd();
    cleanup();
    
    const { unmount: unmountLg } = render(<LastUpdated timestamp={timestamp} size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('text-base');
    unmountLg();
    cleanup();
    
    // Clean up any remaining script tags
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      script.remove();
    });
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