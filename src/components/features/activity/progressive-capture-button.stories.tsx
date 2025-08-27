import type { Meta, StoryObj } from '@storybook/react';
import { ProgressiveCaptureButton } from './progressive-capture-button';

const meta: Meta<typeof ProgressiveCaptureButton> = {
  title: 'Activity/Progressive Capture Button',
  component: ProgressiveCaptureButton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A button component that triggers progressive data capture to fetch missing repository data (reviews, comments, file changes) and improve metrics accuracy.',
      },
    },
  },
  argTypes: {
    owner: {
      control: 'text',
      description: 'Repository owner/organization name',
    },
    repo: {
      control: 'text',
      description: 'Repository name',
    },
    compact: {
      control: 'boolean',
      description: 'Whether to show compact button version',
    },
    onRefreshNeeded: {
      action: 'refreshNeeded',
      description: 'Callback when data refresh is needed',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressiveCaptureButton>;

export const Default: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    compact: true,
  },
};

export const CompactInHeader: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    compact: true,
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-between p-4 border rounded">
        <div>
          <h3 className="text-lg font-semibold">Metrics and Trends</h3>
          <p className="text-sm text-muted-foreground">Repository analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Story />
          <button className="h-8 w-8 p-0 border rounded">📋</button>
        </div>
      </div>
    ),
  ],
};

export const LowDataQualityScenario: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    compact: false,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 border rounded bg-yellow-50">
          <h4 className="font-medium text-yellow-800">Data Quality Issue Detected</h4>
          <p className="text-sm text-yellow-700">
            This repository has PRs but missing review and comment data. Progressive capture can fix
            this.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};
