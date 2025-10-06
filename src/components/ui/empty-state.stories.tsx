import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './empty-state';
import { FileText, Users, Folder } from './icon';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    title: 'No items found',
    description: 'Try adjusting your filters or search criteria',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <FileText className="h-8 w-8" />,
    title: 'No documents',
    description: 'Upload your first document to get started',
  },
};

export const WithAction: Story = {
  args: {
    icon: <Users className="h-8 w-8" />,
    title: 'No team members',
    description: 'Invite team members to collaborate on this project',
    action: {
      label: 'Invite members',
      onClick: () => alert('Invite modal would open'),
    },
  },
};

export const WithExternalLink: Story = {
  args: {
    icon: <FileText className="h-8 w-8" />,
    title: 'No CODEOWNERS file found',
    description:
      "CODEOWNERS files help automatically assign code reviewers based on file ownership. Adding one can improve your team's review workflow.",
    action: {
      label: 'Learn how to add CODEOWNERS',
      href: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
    },
  },
};

export const NoContent: Story = {
  args: {
    icon: <Folder className="h-8 w-8" />,
    title: 'Empty folder',
  },
};
