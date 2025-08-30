import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('should render null when error occurs and no fallback provided', () => {
    render(
      <AnalyticsErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    // When no fallback is provided and an error occurs,
    // the error boundary should not render the erroring component again
    // Since ThrowError always throws, it won't render anything
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
  });

  it('should log errors in development mode', () => {
    process.env.NODE_ENV = 'development';

    render(
      <AnalyticsErrorBoundary fallback={<div>Fallback</div>}>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    // Check that our error boundary's componentDidCatch was called
    // The console.error spy should have been called with our specific message
    const ourErrorLogs = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Analytics Error Boundary caught:')
    );
    expect(ourErrorLogs.length).toBeGreaterThan(0);
  });

  it('should not log errors in production mode', () => {
    process.env.NODE_ENV = 'production';

    render(
      <AnalyticsErrorBoundary fallback={<div>Fallback</div>}>
        <ThrowError shouldThrow={true} />
      </AnalyticsErrorBoundary>
    );

    // In production, our error boundary should NOT log errors
    const ourErrorLogs = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Analytics Error Boundary caught:')
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
