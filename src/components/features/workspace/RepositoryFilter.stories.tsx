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

// Generate mock repository data
const mockRepositories: RepositoryOption[] = [
  { id: '1', name: 'vscode', owner: 'microsoft', full_name: 'microsoft/vscode', stars_count: 155000, language: 'TypeScript' },
  { id: '2', name: 'react', owner: 'facebook', full_name: 'facebook/react', stars_count: 215000, language: 'JavaScript' },
  { id: '3', name: 'next.js', owner: 'vercel', full_name: 'vercel/next.js', stars_count: 115000, language: 'TypeScript' },
  { id: '4', name: 'vue', owner: 'vuejs', full_name: 'vuejs/vue', stars_count: 206000, language: 'TypeScript' },
  { id: '5', name: 'angular', owner: 'angular', full_name: 'angular/angular', stars_count: 93000, language: 'TypeScript' },
  { id: '6', name: 'svelte', owner: 'sveltejs', full_name: 'sveltejs/svelte', stars_count: 75000, language: 'JavaScript' },
  { id: '7', name: 'pytorch', owner: 'pytorch', full_name: 'pytorch/pytorch', stars_count: 75000, language: 'Python' },
  { id: '8', name: 'tensorflow', owner: 'tensorflow', full_name: 'tensorflow/tensorflow', stars_count: 180000, language: 'C++' },
  { id: '9', name: 'rust', owner: 'rust-lang', full_name: 'rust-lang/rust', stars_count: 90000, language: 'Rust' },
  { id: '10', name: 'go', owner: 'golang', full_name: 'golang/go', stars_count: 117000, language: 'Go' },
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
      stars_count: Math.floor(Math.random() * 100000),
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