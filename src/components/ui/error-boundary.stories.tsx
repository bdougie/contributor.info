import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { useState } from 'react';
import { designTokens } from '../../../.storybook/design-tokens';
import { ErrorBoundary } from './error-boundary';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI/Utilities/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A React error boundary component that catches JavaScript errors in child components, logs them, and displays a fallback UI instead of crashing the entire app.',
      },
    },
  },
  tags: ['autodocs', 'interaction'],
  argTypes: {
    children: {
      control: false,
      description: 'Child components to render',
    },
    fallback: {
      control: false,
      description: 'Custom fallback UI to show when an error occurs',
    },
    onError: {
      control: false,
      description: 'Callback function called when an error is caught',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minWidth: '400px',
          padding: designTokens.spacing[4],
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Component that throws an error for testing
const BrokenComponent = ({ shouldBreak = false }: { shouldBreak?: boolean }) => {
  if (shouldBreak) {
    throw new Error('Component failed to render!');
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Component</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This component is working correctly.</p>
      </CardContent>
    </Card>
  );
};

// Component with controlled error for interaction testing
const InteractiveErrorComponent = () => {
  const [hasError, setHasError] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <ErrorBoundary key={hasError ? 'error' : 'ok'}>
        <BrokenComponent shouldBreak={hasError} />
      </ErrorBoundary>
      <Button onClick={() => setHasError(!hasError)}>
        {hasError ? 'Fix Component' : 'Break Component'}
      </Button>
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <ErrorBoundary>
      <Card>
        <CardHeader>
          <CardTitle>Protected Component</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This component is wrapped in an error boundary for safety.</p>
        </CardContent>
      </Card>
    </ErrorBoundary>
  ),
};

export const WithError: Story = {
  render: () => (
    <ErrorBoundary>
      <BrokenComponent shouldBreak={true} />
    </ErrorBoundary>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows the default error UI when a component throws an error.',
      },
    },
  },
};

export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">⚠️ Custom Error Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700">
              We've encountered an issue. Our team has been notified.
            </p>
          </CardContent>
        </Card>
      }
    >
      <BrokenComponent shouldBreak={true} />
    </ErrorBoundary>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates using a custom fallback UI instead of the default error display.',
      },
    },
  },
};

export const WithErrorCallback: Story = {
  render: () => {
    const [errorLog, setErrorLog] = useState<string[]>([]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            setErrorLog((prev) => [...prev, `Error: ${error.message}`]);
            console.log('Error logged:', error, errorInfo);
          }}
        >
          <BrokenComponent shouldBreak={true} />
        </ErrorBoundary>
        {errorLog.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Error Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {errorLog.map((log, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {log}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how to use the onError callback to log or report errors.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => <InteractiveErrorComponent />,
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initially should show working component
    expect(canvas.getByText('Working Component')).toBeInTheDocument();
    expect(canvas.getByText('This component is working correctly.')).toBeInTheDocument();

    // Click button to break component
    const breakButton = canvas.getByRole('button', { name: /Break Component/i });

    // Should now show error UI
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo showing how the error boundary catches and recovers from errors.',
      },
    },
  },
};

export const NestedBoundaries: Story = {
  render: () => (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
        <Card>
          <CardHeader>
            <CardTitle>Parent Component</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This parent component has its own error boundary.</p>
          </CardContent>
        </Card>

        <ErrorBoundary
          fallback={
            <Card className="border-blue-200 bg-blue-50">
              <CardContent>
                <p className="text-blue-700">Child component failed but parent is safe!</p>
              </CardContent>
            </Card>
          }
        >
          <BrokenComponent shouldBreak={true} />
        </ErrorBoundary>

        <Card>
          <CardHeader>
            <CardTitle>Sibling Component</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This sibling component continues to work.</p>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows how nested error boundaries can isolate failures to specific parts of the UI.',
      },
    },
  },
};

export const LoadingWithErrorBoundary: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleLoad = () => {
      setIsLoading(true);
    };

    if (isLoading) {
      return (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </CardContent>
        </Card>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
        <ErrorBoundary key={hasError ? 'error' : 'success'}>
          <BrokenComponent shouldBreak={hasError} />
        </ErrorBoundary>
        <Button onClick={handleLoad}>Reload Data</Button>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Combines loading states with error boundaries for async operations.',
      },
    },
  },
};
