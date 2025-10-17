import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { WorkspaceSubTabs } from './WorkspaceSubTabs';
import { MessageSquare, CheckCircle2 } from '@/components/ui/icon';

const meta = {
  title: 'Workspace/Components/WorkspaceSubTabs',
  component: WorkspaceSubTabs,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof WorkspaceSubTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function WorkspaceSubTabsDemo() {
  const [activeTab, setActiveTab] = useState('needs_response');

  const tabs = [
    { value: 'needs_response', label: 'Needs Response', count: 5 },
    { value: 'replied', label: 'Replies', count: 2 },
  ];

  return (
    <div className="space-y-4">
      <WorkspaceSubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Active tab: <strong>{activeTab}</strong>
        </p>
      </div>
    </div>
  );
}

function WorkspaceSubTabsWithIconsDemo() {
  const [activeTab, setActiveTab] = useState('needs_response');

  const tabs = [
    {
      value: 'needs_response',
      label: 'Needs Response',
      count: 5,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      value: 'replied',
      label: 'Replies',
      count: 2,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      <WorkspaceSubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Active tab: <strong>{activeTab}</strong>
        </p>
      </div>
    </div>
  );
}

function WorkspaceSubTabsWithContentDemo() {
  const [activeTab, setActiveTab] = useState('needs_response');

  const tabs = [
    { value: 'needs_response', label: 'Needs Response', count: 5 },
    { value: 'replied', label: 'Replies', count: 2 },
  ];

  return (
    <WorkspaceSubTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      children={{
        needs_response: (
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Issues Needing Response</h3>
            <p className="text-sm text-muted-foreground">
              These issues are awaiting your response or attention.
            </p>
          </div>
        ),
        replied: (
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Your Replies</h3>
            <p className="text-sm text-muted-foreground">
              These are issues where you've responded and there might be follow-up activity.
            </p>
          </div>
        ),
      }}
    />
  );
}

export const Default: Story = {
  render: () => <WorkspaceSubTabsDemo />,
};

export const WithIcons: Story = {
  render: () => <WorkspaceSubTabsWithIconsDemo />,
};

export const WithContent: Story = {
  render: () => <WorkspaceSubTabsWithContentDemo />,
};

export const NoCount: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('all');
    return (
      <WorkspaceSubTabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  },
};

export const DisabledTab: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('needs_response');
    return (
      <WorkspaceSubTabs
        tabs={[
          { value: 'needs_response', label: 'Needs Response', count: 5 },
          { value: 'replied', label: 'Replies', count: 0, disabled: true },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  },
};
