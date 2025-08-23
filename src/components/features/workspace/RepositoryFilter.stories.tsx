import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RepositoryFilter, SingleRepositoryFilter, type RepositoryOption } from './RepositoryFilter';

const meta: Meta<typeof RepositoryFilter> = {
  title: 'Features/Workspace/RepositoryFilter',
  component: RepositoryFilter,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock repository data with activity metrics and avatars
const mockRepositories: RepositoryOption[] = [
  { id: '1', name: 'vscode', owner: 'microsoft', full_name: 'microsoft/vscode', avatar_url: 'https://github.com/microsoft.png', activity_count: 342, last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), language: 'TypeScript' },
  { id: '2', name: 'react', owner: 'facebook', full_name: 'facebook/react', avatar_url: 'https://github.com/facebook.png', activity_count: 128, last_activity: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), language: 'JavaScript' },
  { id: '3', name: 'next.js', owner: 'vercel', full_name: 'vercel/next.js', avatar_url: 'https://github.com/vercel.png', activity_count: 256, last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), language: 'TypeScript' },
  { id: '4', name: 'vue', owner: 'vuejs', full_name: 'vuejs/vue', avatar_url: 'https://github.com/vuejs.png', activity_count: 89, last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), language: 'TypeScript' },
  { id: '5', name: 'angular', owner: 'angular', full_name: 'angular/angular', avatar_url: 'https://github.com/angular.png', activity_count: 167, last_activity: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), language: 'TypeScript' },
  { id: '6', name: 'svelte', owner: 'sveltejs', full_name: 'sveltejs/svelte', avatar_url: 'https://github.com/sveltejs.png', activity_count: 45, last_activity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), language: 'JavaScript' },
  { id: '7', name: 'pytorch', owner: 'pytorch', full_name: 'pytorch/pytorch', avatar_url: 'https://github.com/pytorch.png', activity_count: 234, last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), language: 'Python' },
  { id: '8', name: 'tensorflow', owner: 'tensorflow', full_name: 'tensorflow/tensorflow', avatar_url: 'https://github.com/tensorflow.png', activity_count: 156, last_activity: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), language: 'C++' },
  { id: '9', name: 'rust', owner: 'rust-lang', full_name: 'rust-lang/rust', avatar_url: 'https://github.com/rust-lang.png', activity_count: 98, last_activity: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), language: 'Rust' },
  { id: '10', name: 'go', owner: 'golang', full_name: 'golang/go', avatar_url: 'https://github.com/golang.png', activity_count: 201, last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), language: 'Go' },
];

// Wrapper component for state management
function RepositoryFilterWrapper(props: Omit<Parameters<typeof RepositoryFilter>[0], 'selectedRepositories' | 'onSelectionChange'>) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <RepositoryFilter
      {...props}
      selectedRepositories={selected}
      onSelectionChange={setSelected}
    />
  );
}

function SingleRepositoryFilterWrapper(props: Omit<Parameters<typeof SingleRepositoryFilter>[0], 'selectedRepository' | 'onSelectionChange'>) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <SingleRepositoryFilter
      {...props}
      selectedRepository={selected}
      onSelectionChange={setSelected}
    />
  );
}

export const Default: Story = {
  render: () => (
    <RepositoryFilterWrapper
      repositories={mockRepositories}
    />
  ),
};

export const WithPreselected: Story = {
  render: () => {
    const Component = () => {
      const [selected, setSelected] = useState<string[]>(['1', '2', '3']);
      return (
        <RepositoryFilter
          repositories={mockRepositories}
          selectedRepositories={selected}
          onSelectionChange={setSelected}
        />
      );
    };
    return <Component />;
  },
};

export const AllSelected: Story = {
  render: () => {
    const Component = () => {
      const [selected, setSelected] = useState<string[]>(mockRepositories.map(r => r.id));
      return (
        <RepositoryFilter
          repositories={mockRepositories}
          selectedRepositories={selected}
          onSelectionChange={setSelected}
        />
      );
    };
    return <Component />;
  },
};

export const EmptyRepositories: Story = {
  render: () => (
    <RepositoryFilterWrapper
      repositories={[]}
      placeholder="No repositories available"
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <RepositoryFilterWrapper
      repositories={mockRepositories}
      disabled={true}
    />
  ),
};

export const CustomPlaceholder: Story = {
  render: () => (
    <RepositoryFilterWrapper
      repositories={mockRepositories}
      placeholder="Filter by repository..."
    />
  ),
};

export const ManyRepositories: Story = {
  render: () => {
    const manyRepos: RepositoryOption[] = Array.from({ length: 50 }, (_, i) => ({
      id: `repo-${i}`,
      name: `repository-${i}`,
      owner: `owner-${i % 10}`,
      full_name: `owner-${i % 10}/repository-${i}`,
      avatar_url: `https://github.com/owner-${i % 10}.png`,
      activity_count: Math.floor(Math.random() * 500) + 10,
      last_activity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      language: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'][i % 5],
    }));
    
    return (
      <RepositoryFilterWrapper
        repositories={manyRepos}
      />
    );
  },
};

// Single Selection Stories
export const SingleSelection: Story = {
  render: () => (
    <SingleRepositoryFilterWrapper
      repositories={mockRepositories}
    />
  ),
};

export const SingleWithPreselected: Story = {
  render: () => {
    const Component = () => {
      const [selected, setSelected] = useState<string | null>('1');
      return (
        <SingleRepositoryFilter
          repositories={mockRepositories}
          selectedRepository={selected}
          onSelectionChange={setSelected}
        />
      );
    };
    return <Component />;
  },
};

export const SingleDisabled: Story = {
  render: () => {
    const Component = () => {
      const [selected, setSelected] = useState<string | null>('2');
      return (
        <SingleRepositoryFilter
          repositories={mockRepositories}
          selectedRepository={selected}
          onSelectionChange={setSelected}
          disabled={true}
        />
      );
    };
    return <Component />;
  },
};