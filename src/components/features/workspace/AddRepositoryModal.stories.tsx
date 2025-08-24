import type { Meta, StoryObj } from '@storybook/react';
import { AddRepositoryModal } from './AddRepositoryModal';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof AddRepositoryModal> = {
  title: 'Features/Workspace/AddRepositoryModal',
  component: AddRepositoryModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper component to manage modal state
function AddRepositoryModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Add Repository Modal</Button>
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <AddRepositoryModalDemo />,
};

// Story showing the modal open by default
export const OpenModal: Story = {
  args: {
    open: true,
    workspaceId: 'test-workspace-id',
  },
  render: (args) => {
    const [open, setOpen] = useState(args.open);
    
    return (
      <AddRepositoryModal
        {...args}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};

// Story with mock search results
export const WithSearchResults: Story = {
  parameters: {
    mockData: [
      {
        url: '/api/repositories/search',
        method: 'GET',
        status: 200,
        response: {
          data: [
            {
              id: '1',
              owner: 'facebook',
              name: 'react',
              full_name: 'facebook/react',
              description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
              language: 'JavaScript',
              stargazers_count: 200000,
              is_tracked: true,
            },
            {
              id: '2',
              owner: 'vuejs',
              name: 'vue',
              full_name: 'vuejs/vue',
              description: 'A progressive, incrementally-adoptable JavaScript framework for building UI on the web.',
              language: 'TypeScript',
              stargazers_count: 195000,
              is_tracked: true,
            },
            {
              id: '3',
              owner: 'angular',
              name: 'angular',
              full_name: 'angular/angular',
              description: 'One framework. Mobile & desktop.',
              language: 'TypeScript',
              stargazers_count: 85000,
              is_tracked: true,
            },
          ],
        },
      },
    ],
  },
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};

// Story simulating loading state
export const LoadingState: Story = {
  parameters: {
    mockData: [
      {
        url: '/api/repositories/add',
        method: 'POST',
        status: 200,
        delay: 2000, // 2 second delay to show loading state
        response: {
          success: true,
        },
      },
    ],
  },
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};

// Story showing error state
export const ErrorState: Story = {
  parameters: {
    mockData: [
      {
        url: '/api/repositories/add',
        method: 'POST',
        status: 403,
        response: {
          error: 'Repository limit reached. Maximum 10 repositories allowed.',
        },
      },
    ],
  },
  render: () => {
    const [open, setOpen] = useState(true);
    
    return (
      <AddRepositoryModal
        open={open}
        onOpenChange={setOpen}
        workspaceId="test-workspace-id"
        onSuccess={() => {
          console.log('Repository added successfully');
          setOpen(false);
        }}
      />
    );
  },
};