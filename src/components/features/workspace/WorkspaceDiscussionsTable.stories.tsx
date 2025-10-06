import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { WorkspaceDiscussionsTable } from './WorkspaceDiscussionsTable';

// Mock repositories
const mockRepositories = [
  {
    id: '1',
    name: 'react',
    owner: 'facebook',
    full_name: 'facebook/react',
  },
  {
    id: '2',
    name: 'vue',
    owner: 'vuejs',
    full_name: 'vuejs/vue',
  },
];

// Note: Mock data not needed for stories as component fetches real data from Supabase
// For true story mocking, use MSW (Mock Service Worker) - see other components

const meta: Meta<typeof WorkspaceDiscussionsTable> = {
  title: 'Components/Workspace/DiscussionsTable',
  component: WorkspaceDiscussionsTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays GitHub Discussions from workspace repositories with filtering, sorting, and search capabilities. Includes access control for workspace members.',
      },
    },
  },
  argTypes: {
    repositories: {
      description: 'List of repositories in the workspace',
    },
    selectedRepositories: {
      description: 'Array of selected repository IDs for filtering',
    },
    userRole: {
      control: 'select',
      options: [null, 'owner', 'maintainer', 'editor', 'contributor'],
      description: 'User role in the workspace',
    },
    isLoggedIn: {
      control: 'boolean',
      description: 'Whether the user is logged in',
    },
  },
  args: {
    repositories: mockRepositories,
    selectedRepositories: [],
    isLoggedIn: true,
    userRole: 'owner',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-7xl mx-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with discussions
export const Default: Story = {};

// Story with selected repository filter
export const WithRepositoryFilter: Story = {
  args: {
    selectedRepositories: ['1'], // Only facebook/react
  },
};

// Story showing empty state (no discussions)
export const EmptyState: Story = {
  args: {
    repositories: [],
  },
};

// Story showing loading state
export const Loading: Story = {
  args: {
    repositories: mockRepositories,
  },
};

// Story showing access control for logged out user
export const LoggedOut: Story = {
  args: {
    isLoggedIn: false,
    userRole: null,
  },
};

// Story showing access control for logged in user without workspace
export const NoWorkspaceAccess: Story = {
  args: {
    isLoggedIn: true,
    userRole: null, // No role = not a workspace member
  },
};

// Story with contributor role (has access)
export const ContributorAccess: Story = {
  args: {
    isLoggedIn: true,
    userRole: 'contributor',
  },
};

// Interactive accessibility test
export const AccessibilityTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check heading is present
    await expect(canvas.getByText('Discussions')).toBeInTheDocument();

    // Check search input has label
    const searchInput = canvas.getByLabelText('Search discussions');
    await expect(searchInput).toBeInTheDocument();

    // Check sort buttons have aria-pressed
    const newestButton = canvas.getByLabelText('Sort by newest');
    await expect(newestButton).toHaveAttribute('aria-pressed', 'true');

    // Check filter buttons
    const allButton = canvas.getByLabelText('Show all discussions');
    await expect(allButton).toBeInTheDocument();
  },
};

// Interactive search test
export const InteractiveSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find and type in search input
    const searchInput = canvas.getByLabelText('Search discussions');
    await userEvent.type(searchInput, 'TypeScript');

    // Should filter to only show TypeScript-related discussion
    await expect(
      canvas.getByText('Feature request: Better TypeScript support')
    ).toBeInTheDocument();
  },
};

// Story showing different states side by side
export const AllStates: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Default State</h3>
        <WorkspaceDiscussionsTable
          repositories={mockRepositories}
          selectedRepositories={[]}
          isLoggedIn={true}
          userRole="owner"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Filtered State (React only)</h3>
        <WorkspaceDiscussionsTable
          repositories={mockRepositories}
          selectedRepositories={['1']}
          isLoggedIn={true}
          userRole="owner"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Access Denied (Not Logged In)</h3>
        <WorkspaceDiscussionsTable
          repositories={mockRepositories}
          selectedRepositories={[]}
          isLoggedIn={false}
          userRole={null}
        />
      </div>
    </div>
  ),
};
