import type { Meta, StoryObj } from '@storybook/react';
import { RoleBadge, RoleStats } from './role-badge';

const meta: Meta<typeof RoleBadge> = {
  title: 'UI/Role Badge',
  component: RoleBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    role: {
      control: 'select',
      options: ['owner', 'maintainer', 'contributor', 'bot'],
    },
    showIcon: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  args: {
    role: 'owner',
    showIcon: true,
  },
};

export const Maintainer: Story = {
  args: {
    role: 'maintainer',
    showIcon: true,
  },
};

export const Contributor: Story = {
  args: {
    role: 'contributor',
    showIcon: true,
  },
};

export const Bot: Story = {
  args: {
    role: 'bot',
    showIcon: true,
  },
};

export const WithoutIcon: Story = {
  args: {
    role: 'maintainer',
    showIcon: false,
  },
};

export const AllRoles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <RoleBadge role="owner" />
      <RoleBadge role="maintainer" />
      <RoleBadge role="contributor" />
      <RoleBadge role="bot" />
    </div>
  ),
};

export const RoleStatistics: Story = {
  render: () => (
    <RoleStats
      stats={{
        owners: 2,
        maintainers: 8,
        contributors: 24,
        bots: 3,
        total: 37,
      }}
    />
  ),
};

export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  render: () => (
    <div className="dark">
      <div className="flex flex-wrap gap-2 p-4 bg-gray-900">
        <RoleBadge role="owner" />
        <RoleBadge role="maintainer" />
        <RoleBadge role="contributor" />
        <RoleBadge role="bot" />
      </div>
    </div>
  ),
};