import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsErrorBoundary, withAnalyticsErrorBoundary } from '../AnalyticsErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Analytics error!');
  }
  return <div>No error</div>;
};

// Component that might fail
const AnalyticsComponent: React.FC<{ fail?: boolean }> = ({ fail = false }) => {
  if (fail) {
    throw new Error('Analytics tracking failed');
  }
  return <div data-testid="analytics-component">Analytics Working</div>;
};

describe('AnalyticsErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV || '';
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it('should render children when there is no error', () => {
    render(
      <AnalyticsErrorBoundary>
        <div data-testid="child">Child content</div>
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should render fallback when error occurs', () => {
    const fallback = <div data-testid="fallback">Fallback UI</div>;

    render(
      <AnalyticsErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
  });

  it('should render children as fallback when no fallback provided', () => {
    const SafeChild = () => <div data-testid="safe-child">Safe content</div>;

    render(
      <AnalyticsErrorBoundary>
        <ThrowError shouldThrow={true} />
        <SafeChild />
      </AnalyticsErrorBoundary>
    );

    // Error boundary should catch the error but still render something
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should log errors in development mode', () => {
    process.env.NODE_ENV = 'development';

    render(
      <AnalyticsErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Analytics Error Boundary caught:'),
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should not log errors in production mode', () => {
    process.env.NODE_ENV = 'production';

    render(
      <AnalyticsErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    // Console.error should only be called by React itself, not our error boundary
    const ourErrorLogs = consoleErrorSpy.mock.calls.filter((call) =>
      call[0]?.includes('Analytics Error Boundary caught:')
    );
    expect(ourErrorLogs).toHaveLength(0);
  });

  describe('withAnalyticsErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const WrappedComponent = withAnalyticsErrorBoundary(AnalyticsComponent);

      render(<WrappedComponent />);

      expect(screen.getByTestId('analytics-component')).toBeInTheDocument();
    });

    it('should handle errors in wrapped component', () => {
      const fallback = <div data-testid="hoc-fallback">HOC Fallback</div>;
      const WrappedComponent = withAnalyticsErrorBoundary(AnalyticsComponent, fallback);

      render(<WrappedComponent fail={true} />);

      expect(screen.getByTestId('hoc-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('analytics-component')).not.toBeInTheDocument();
    });

    it('should pass props to wrapped component', () => {
      const TestComponent: React.FC<{ message: string }> = ({ message }) => (
        <div data-testid="message">{message}</div>
      );

      const WrappedComponent = withAnalyticsErrorBoundary(TestComponent);

      render(<WrappedComponent message="Hello Analytics" />);

      expect(screen.getByTestId('message')).toHaveTextContent('Hello Analytics');
    });
  });
});
