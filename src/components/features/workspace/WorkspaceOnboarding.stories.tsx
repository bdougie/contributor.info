import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceOnboarding, WorkspaceOnboardingCompact } from './WorkspaceOnboarding';
import { useState } from 'react';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { BrowserRouter } from 'react-router-dom';

const meta = {
  title: 'Features/Workspace/WorkspaceOnboarding',
  component: WorkspaceOnboarding,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Onboarding component that encourages users to create their first workspace. Shows the value proposition and benefits of using workspaces.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="container max-w-2xl">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof WorkspaceOnboarding>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onCreateClick: () => console.log('Create workspace clicked'),
  },
};

export const WithCustomClass: Story = {
  args: {
    onCreateClick: () => console.log('Create workspace clicked'),
    className: 'shadow-lg',
  },
};

// Interactive version with modal
function InteractiveOnboarding() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <WorkspaceOnboarding onCreateClick={() => setModalOpen(true)} />
      <WorkspaceCreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={(id) => console.log('Workspace created:', id)}
      />
    </>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveOnboarding />,
  parameters: {
    docs: {
      description: {
        story: 'Interactive version that opens the creation modal when clicked',
      },
    },
  },
};

// Compact version story
export const Compact: Story = {
  render: () => (
    <WorkspaceOnboardingCompact onCreateClick={() => console.log('Create workspace clicked')} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Compact version for users who already have workspaces but might want to create another',
      },
    },
  },
};

// Mobile responsive stories
export const Mobile: Story = {
  args: {
    onCreateClick: () => console.log('Create workspace clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const Tablet: Story = {
  args: {
    onCreateClick: () => console.log('Create workspace clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
