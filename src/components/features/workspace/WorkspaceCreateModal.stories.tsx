import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icon';

const meta = {
  title: 'Features/Workspace/WorkspaceCreateModal',
  component: WorkspaceCreateModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A modal dialog for creating new workspaces. Includes form validation, error handling, and loading states.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof WorkspaceCreateModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper component to handle modal state
function ModalWrapper({ 
  defaultOpen = false,
  onSuccess,
  mode = 'create',
  initialValues,
  workspaceId,
}: { 
  defaultOpen?: boolean;
  onSuccess?: (workspaceId: string) => void;
  mode?: 'create' | 'edit';
  initialValues?: any;
  workspaceId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {mode === 'create' ? 'Create Workspace' : 'Edit Workspace'}
      </Button>
      
      <WorkspaceCreateModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
        mode={mode}
        initialValues={initialValues}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <ModalWrapper />,
};

export const InitiallyOpen: Story = {
  render: () => <ModalWrapper defaultOpen={true} />,
};

export const WithSuccessCallback: Story = {
  render: () => (
    <ModalWrapper 
      defaultOpen={false}
      onSuccess={(workspaceId) => {
        console.log('Workspace created with ID:', workspaceId);
        alert(`Workspace created! ID: ${workspaceId}`);
      }}
    />
  ),
};

// Form-only stories using the WorkspaceCreateForm directly
import { WorkspaceCreateForm } from './WorkspaceCreateForm';

export const FormDefault: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async (data) => {
          console.log('Form submitted:', data);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
      />
    </div>
  ),
};

export const FormWithCancel: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async (data) => {
          console.log('Form submitted:', data);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
        onCancel={() => console.log('Cancelled')}
      />
    </div>
  ),
};

export const FormLoading: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        loading={true}
      />
    </div>
  ),
};

export const FormWithError: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        error="A workspace with this name already exists"
      />
    </div>
  ),
};

export const FormWithLimitError: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        error="You have reached the limit of 3 workspaces for your current plan"
      />
    </div>
  ),
};

export const FormWithNetworkError: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        error="Network error: Unable to connect to the server. Please check your connection and try again."
      />
    </div>
  ),
};

// Interactive form with validation
export const FormInteractive: Story = {
  render: () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (data: any) => {
      setLoading(true);
      setError(null);
      
      console.log('Submitting:', data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate random success/error
      if (Math.random() > 0.5) {
        setError('Simulated error: Workspace name already exists');
      } else {
        alert('Success! Workspace created.');
        setError(null);
      }
      
      setLoading(false);
    };

    return (
      <div className="max-w-[500px] p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Interactive Form Example</h2>
        <WorkspaceCreateForm
          onSubmit={handleSubmit}
          onCancel={() => console.log('Cancelled')}
          loading={loading}
          error={error}
        />
      </div>
    );
  },
};

// Edit mode stories
export const EditMode: Story = {
  render: () => (
    <ModalWrapper 
      mode="edit"
      initialValues={{
        name: "My Awesome Projects",
        description: "A collection of open source projects I contribute to",
        visibility: "public"
      }}
      workspaceId="workspace-123"
    />
  ),
};

export const EditModeOpen: Story = {
  render: () => (
    <ModalWrapper 
      defaultOpen={true}
      mode="edit"
      initialValues={{
        name: "Team Collaboration Hub",
        description: "Central workspace for team projects and contributions",
        visibility: "public"
      }}
      workspaceId="workspace-456"
    />
  ),
};

export const FormEditMode: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async (data) => {
          console.log('Updating workspace:', data);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }}
        onCancel={() => console.log('Cancelled')}
        mode="edit"
        initialValues={{
          name: "Engineering Team Workspace",
          description: "Track all engineering team contributions across our repositories",
          visibility: "public"
        }}
      />
    </div>
  ),
};

export const FormEditModeLoading: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        mode="edit"
        loading={true}
        initialValues={{
          name: "Product Team Hub",
          description: "Product team's workspace for tracking feature development",
          visibility: "public"
        }}
      />
    </div>
  ),
};

export const FormEditModeWithError: Story = {
  render: () => (
    <div className="max-w-[500px] p-6 border rounded-lg">
      <WorkspaceCreateForm
        onSubmit={async () => {}}
        mode="edit"
        error="Workspace name is already taken by another workspace"
        initialValues={{
          name: "Design System",
          description: "Workspace for design system component development",
          visibility: "public"
        }}
      />
    </div>
  ),
};