import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  WorkspaceTabNavigation,
  WorkspaceTabNavigationMobile,
  WorkspaceTabWithContent,
  type TabValue,
} from './WorkspaceTabNavigation';
import { Card, CardContent } from '@/components/ui/card';

const meta: Meta<typeof WorkspaceTabNavigation> = {
  title: 'Features/Workspace/WorkspaceTabNavigation',
  component: WorkspaceTabNavigation,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component for state management
function TabNavigationWrapper(
  props: Omit<Parameters<typeof WorkspaceTabNavigation>[0], 'activeTab' | 'onTabChange'>
) {
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  return <WorkspaceTabNavigation {...props} activeTab={activeTab} onTabChange={setActiveTab} />;
}

export const Default: Story = {
  render: () => <TabNavigationWrapper />,
};

export const WithCounts: Story = {
  render: () => (
    <TabNavigationWrapper
      showCounts={{
        issues: 24,
        pullRequests: 12,
        contributors: 8,
      }}
    />
  ),
};

export const WithHighCounts: Story = {
  render: () => (
    <TabNavigationWrapper
      showCounts={{
        issues: 156,
        pullRequests: 89,
        contributors: 234,
      }}
    />
  ),
};

export const WithContent: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<TabValue>('overview');
    return (
      <WorkspaceTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showCounts={{
          issues: 15,
          pullRequests: 8,
          contributors: 12,
        }}
      >
        <Card>
          <CardContent className="pt-6">
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Workspace Overview</h3>
                <p className="text-muted-foreground">
                  This is the overview tab content. It would typically show metrics and charts.
                </p>
              </div>
            )}
            {activeTab === 'issues' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Issues</h3>
                <p className="text-muted-foreground">
                  This tab would display the WorkspaceIssuesTable component.
                </p>
              </div>
            )}
            {activeTab === 'pull-requests' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Pull Requests</h3>
                <p className="text-muted-foreground">
                  This tab would display the WorkspacePullRequestsTable component.
                </p>
              </div>
            )}
            {activeTab === 'contributors' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Contributors</h3>
                <p className="text-muted-foreground">
                  This tab would display the ContributorsList component.
                </p>
              </div>
            )}
            {activeTab === 'activity' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Activity</h3>
                <p className="text-muted-foreground">
                  This tab would show recent activity and timeline.
                </p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Settings</h3>
                <p className="text-muted-foreground">
                  This tab would contain workspace configuration options.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </WorkspaceTabNavigation>
    );
  },
};

export const MobileVersion: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<TabValue>('overview');
    return (
      <div className="max-w-sm mx-auto">
        <WorkspaceTabNavigationMobile
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showCounts={{
            issues: 5,
            pullRequests: 3,
            contributors: 7,
          }}
        />
        <div className="p-4">
          <p className="text-center text-muted-foreground">Active tab: {activeTab}</p>
        </div>
      </div>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const WithDisabledTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<TabValue>('overview');
    const customTabs = [
      {
        value: 'overview' as TabValue,
        label: 'Overview',
        icon: <span>📊</span>,
      },
      {
        value: 'issues' as TabValue,
        label: 'Issues',
        icon: <span>🐛</span>,
        badge: 12,
      },
      {
        value: 'pull-requests' as TabValue,
        label: 'Pull Requests',
        icon: <span>🔀</span>,
        badge: 8,
      },
      {
        value: 'contributors' as TabValue,
        label: 'Contributors',
        icon: <span>👥</span>,
        disabled: true,
      },
      {
        value: 'activity' as TabValue,
        label: 'Activity',
        icon: <span>📈</span>,
        disabled: true,
      },
      {
        value: 'settings' as TabValue,
        label: 'Settings',
        icon: <span>⚙️</span>,
      },
    ];

    return (
      <WorkspaceTabNavigation activeTab={activeTab} onTabChange={setActiveTab} tabs={customTabs} />
    );
  },
};

export const TabsWithCustomContent: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<TabValue>('overview');

    const content: Record<TabValue, React.ReactNode> = {
      overview: (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Dashboard Overview</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">152</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">48</p>
                <p className="text-sm text-muted-foreground">Open PRs</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Active Contributors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
      issues: (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold">Issues List</h3>
            <p className="text-muted-foreground mt-2">Issues table would go here...</p>
          </CardContent>
        </Card>
      ),
      'pull-requests': (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold">Pull Requests</h3>
            <p className="text-muted-foreground mt-2">PR table would go here...</p>
          </CardContent>
        </Card>
      ),
      contributors: (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold">Contributors</h3>
            <p className="text-muted-foreground mt-2">Contributors list would go here...</p>
          </CardContent>
        </Card>
      ),
      activity: (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <p className="text-muted-foreground mt-2">Activity timeline would go here...</p>
          </CardContent>
        </Card>
      ),
      settings: (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold">Workspace Settings</h3>
            <p className="text-muted-foreground mt-2">Settings form would go here...</p>
          </CardContent>
        </Card>
      ),
    };

    return (
      <WorkspaceTabWithContent
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showCounts={{
          issues: 152,
          pullRequests: 48,
          contributors: 23,
        }}
      >
        {content}
      </WorkspaceTabWithContent>
    );
  },
};
