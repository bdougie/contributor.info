import type { Meta, StoryObj } from '@storybook/react';
import { RetryIndicator, useRetryState } from './retry-indicator';
import { useState } from 'react';

const meta = {
  title: 'UI/RetryIndicator',
  component: RetryIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RetryIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    retryState: {
      isRetrying: false,
      attempt: 0,
      maxAttempts: 3,
    },
  },
};

export const Retrying: Story = {
  args: {
    retryState: {
      isRetrying: true,
      attempt: 2,
      maxAttempts: 3,
    },
  },
};

export const RetryingWithCountdown: Story = {
  args: {
    retryState: {
      isRetrying: true,
      attempt: 1,
      maxAttempts: 3,
      nextRetryIn: 5000,
    },
  },
};

export const Failed: Story = {
  args: {
    retryState: {
      isRetrying: false,
      attempt: 3,
      maxAttempts: 3,
      error: new Error('Failed to connect to server'),
    },
    onRetry: () => console.log('Retry clicked'),
  },
};

export const Compact: Story = {
  args: {
    retryState: {
      isRetrying: true,
      attempt: 2,
      maxAttempts: 3,
    },
    compact: true,
  },
};

export const CompactFailed: Story = {
  args: {
    retryState: {
      isRetrying: false,
      attempt: 3,
      maxAttempts: 3,
      error: new Error('Connection timeout'),
    },
    onRetry: () => console.log('Retry clicked'),
    compact: true,
  },
};

// Interactive demo
export const Interactive: Story = {
  render: () => {
    const Component = () => {
      const [retryState, setRetryState] = useRetryState();
      const [isLoading, setIsLoading] = useState(false);

      const simulateRetry = async () => {
        setIsLoading(true);

        for (let i = 1; i <= 3; i++) {
          setRetryState({
            isRetrying: true,
            attempt: i,
            maxAttempts: 3,
            nextRetryIn: Math.pow(2, i - 1) * 1000,
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));

          if (i === 3) {
            setRetryState({
              isRetrying: false,
              attempt: 3,
              maxAttempts: 3,
              error: new Error('Failed after 3 attempts'),
            });
            break;
          }
        }

        setIsLoading(false);
      };

      return (
        <div className="space-y-4 w-96">
          <RetryIndicator retryState={retryState} onRetry={simulateRetry} />

          <div className="flex gap-2">
            <button
              onClick={simulateRetry}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Simulate Retry
            </button>

            <button
              onClick={() =>
                setRetryState({
                  isRetrying: false,
                  attempt: 0,
                  maxAttempts: 3,
                })
              }
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </div>
      );
    };

    return <Component />;
  },
};
