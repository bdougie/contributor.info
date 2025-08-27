import type { Meta, StoryObj } from '@storybook/react';
import { LastUpdated, LastUpdatedTime } from './last-updated';

const meta: Meta<typeof LastUpdated> = {
  title: 'UI/LastUpdated',
  component: LastUpdated,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Component for displaying when content was last updated with both human-readable relative time and machine-readable timestamps for SEO.',
      },
    },
  },
  argTypes: {
    timestamp: {
      control: 'date',
      description: 'ISO 8601 timestamp or Date object',
    },
    label: {
      control: 'text',
      description: 'Label to display before the timestamp',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    showIcon: {
      control: 'boolean',
    },
    includeStructuredData: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof LastUpdated>;

// Generate timestamps for different scenarios
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

export const Default: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
  },
};

export const JustUpdated: Story = {
  args: {
    timestamp: new Date(now.getTime() - 30 * 1000).toISOString(), // 30 seconds ago
    label: 'Data refreshed',
  },
};

export const OneHourAgo: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
  },
};

export const OneDayAgo: Story = {
  args: {
    timestamp: oneDayAgo.toISOString(),
  },
};

export const OneWeekAgo: Story = {
  args: {
    timestamp: oneWeekAgo.toISOString(),
  },
};

export const OneMonthAgo: Story = {
  args: {
    timestamp: oneMonthAgo.toISOString(),
  },
};

export const CustomLabel: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    label: 'Repository data updated',
  },
};

export const WithoutIcon: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    showIcon: false,
  },
};

export const SmallSize: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    size: 'sm',
  },
};

export const MediumSize: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    size: 'md',
  },
};

export const LargeSize: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    size: 'lg',
  },
};

export const WithoutStructuredData: Story = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    includeStructuredData: false,
  },
};

// LastUpdatedTime stories
const timeOnlyMeta: Meta<typeof LastUpdatedTime> = {
  title: 'UI/LastUpdatedTime',
  component: LastUpdatedTime,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Lightweight version that only shows the relative time without label or icon.',
      },
    },
  },
};

export const TimeOnly: StoryObj<typeof LastUpdatedTime> = {
  args: {
    timestamp: oneHourAgo.toISOString(),
  },
};

export const TimeOnlySmall: StoryObj<typeof LastUpdatedTime> = {
  args: {
    timestamp: oneHourAgo.toISOString(),
    size: 'sm',
  },
};

// Multiple timestamps for comparison
export const MultipleTimestamps: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Different Time Periods</h3>
        <div className="space-y-1">
          <LastUpdated timestamp={new Date(now.getTime() - 30 * 1000)} label="Just now" />
          <LastUpdated timestamp={oneHourAgo} label="1 hour ago" />
          <LastUpdated timestamp={oneDayAgo} label="1 day ago" />
          <LastUpdated timestamp={oneWeekAgo} label="1 week ago" />
          <LastUpdated timestamp={oneMonthAgo} label="1 month ago" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Different Sizes</h3>
        <div className="space-y-1">
          <LastUpdated timestamp={oneHourAgo} size="sm" label="Small" />
          <LastUpdated timestamp={oneHourAgo} size="md" label="Medium" />
          <LastUpdated timestamp={oneHourAgo} size="lg" label="Large" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Different Styles</h3>
        <div className="space-y-1">
          <LastUpdated timestamp={oneHourAgo} />
          <LastUpdated timestamp={oneHourAgo} showIcon={false} label="No icon" />
          <LastUpdatedTime timestamp={oneHourAgo} />
        </div>
      </div>
    </div>
  ),
};

// Export the time-only meta for proper Storybook organization
export { timeOnlyMeta as LastUpdatedTimeMeta };
