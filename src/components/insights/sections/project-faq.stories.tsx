import type { Meta, StoryObj } from '@storybook/react';
import { ProjectFAQ } from './project-faq';

const meta: Meta<typeof ProjectFAQ> = {
  title: 'Components/Insights/ProjectFAQ',
  component: ProjectFAQ,
  parameters: {
    layout: 'padded',
  },
  args: {
    owner: 'facebook',
    repo: 'react',
    timeRange: '30d',
  },
};

export default meta;
type Story = StoryObj<typeof ProjectFAQ>;

export const Default: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    timeRange: '30d',
  },
};

export const LongTimeRange: Story = {
  args: {
    owner: 'microsoft',
    repo: 'typescript',
    timeRange: '1y',
  },
};

export const SmallProject: Story = {
  args: {
    owner: 'example',
    repo: 'small-project',
    timeRange: '90d',
  },
};
