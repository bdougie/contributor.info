import type { Meta, StoryObj } from '@storybook/react';
import { TimeRangeSelector, TimeRangeQuickSelect } from './TimeRangeSelector';
import { useState } from 'react';
import { toast } from 'sonner';

const meta = {
  title: 'Features/Workspace/TimeRangeSelector',
  component: TimeRangeSelector,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A time range selector with tier-based access control and upgrade prompts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'select',
      options: ['7d', '30d', '90d', '1y', 'all'],
      description: 'Currently selected time range',
    },
    tier: {
      control: 'select',
      options: ['free', 'pro', 'enterprise'],
      description: 'User subscription tier',
    },
    variant: {
      control: 'select',
      options: ['select', 'buttons'],
      description: 'Display variant',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the selector',
    },
  },
} satisfies Meta<typeof TimeRangeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper component
const InteractiveWrapper = ({
  tier = 'free',
  variant = 'select' as const,
  initialValue = '30d' as const,
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <TimeRangeSelector
      value={value}
      onChange={setValue}
      tier={tier}
      variant={variant}
      onUpgradeClick={() => toast.info('Upgrade clicked! This would open the pricing page.')}
    />
  );
};

export const SelectVariant: Story = {
  args: {
    value: '30d',
    tier: 'free',
    variant: 'select',
  },
  render: (args) => <InteractiveWrapper {...args} />,
};

export const ButtonVariant: Story = {
  args: {
    value: '30d',
    tier: 'free',
    variant: 'buttons',
  },
  render: (args) => <InteractiveWrapper {...args} />,
};

export const FreeTier: Story = {
  args: {
    value: '7d',
    tier: 'free',
    variant: 'select',
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Free tier users can only access 7 and 30 day ranges',
      },
    },
  },
};

export const ProTier: Story = {
  args: {
    value: '90d',
    tier: 'pro',
    variant: 'select',
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Pro tier users can access up to 1 year of data',
      },
    },
  },
};

export const EnterpriseTier: Story = {
  args: {
    value: 'all',
    tier: 'enterprise',
    variant: 'select',
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Enterprise users have access to all time ranges',
      },
    },
  },
};

export const QuickSelect: Story = {
  render: () => {
    const QuickSelectWrapper = () => {
      const [value, setValue] = useState<'7d' | '30d' | '90d'>('30d');

      return (
        <TimeRangeQuickSelect
          value={value}
          onChange={setValue}
          tier="free"
          onUpgradeClick={() => toast.info('Upgrade to Pro for 90-day analytics!')}
        />
      );
    };

    return <QuickSelectWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Quick select buttons for common time ranges',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    value: '30d',
    tier: 'pro',
    variant: 'select',
    disabled: true,
  },
};

export const CustomRanges: Story = {
  render: () => {
    const CustomWrapper = () => {
      const [value, setValue] = useState<'7d' | '30d'>('7d');

      return (
        <TimeRangeSelector
          value={value}
          onChange={setValue}
          availableRanges={['7d', '30d']}
          tier="free"
          variant="buttons"
        />
      );
    };

    return <CustomWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Selector with custom available ranges',
      },
    },
  },
};

export const ComparisonDemo: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Free Tier</h3>
        <InteractiveWrapper tier="free" variant="buttons" />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Pro Tier</h3>
        <InteractiveWrapper tier="pro" variant="buttons" initialValue="90d" />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Enterprise Tier</h3>
        <InteractiveWrapper tier="enterprise" variant="buttons" initialValue="1y" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of different tier access levels',
      },
    },
  },
};

export const IntegratedExample: Story = {
  render: () => {
    const IntegratedWrapper = () => {
      const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
      const [tier] = useState<'free' | 'pro' | 'enterprise'>('free');

      return (
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activity Dashboard</h2>
            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              tier={tier}
              onUpgradeClick={() => {
                toast.info(
                  <div>
                    <p className="font-semibold">Unlock more insights!</p>
                    <p className="text-sm">
                      Upgrade to Pro to access historical data and advanced analytics.
                    </p>
                  </div>
                );
              }}
            />
          </div>

          <div className="bg-muted/50 rounded p-4">
            <p className="text-sm text-muted-foreground">
              Showing data for: <span className="font-semibold">{timeRange}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current tier: <span className="font-semibold capitalize">{tier}</span>
            </p>
          </div>
        </div>
      );
    };

    return <IntegratedWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of time range selector integrated in a dashboard header',
      },
    },
  },
};
