import type { Meta, StoryObj } from '@storybook/react';
import { RepositoryList, RepositoryListSkeleton, type Repository } from './RepositoryList';
import { useState } from 'react';
import { toast } from 'sonner';

// Sample repository data
const generateRepositories = (count: number): Repository[] => {
  const languages = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'Ruby'];
  const owners = ['facebook', 'google', 'microsoft', 'vercel', 'openai', 'anthropic'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `repo-${i + 1}`,
    full_name: `${owners[i % owners.length]}/project-${i + 1}`,
    owner: owners[i % owners.length],
    name: `project-${i + 1}`,
    description: i % 2 === 0 
      ? `A powerful ${languages[i % languages.length]} library for building scalable applications with modern architecture`
      : undefined,
    language: languages[i % languages.length],
    stars: Math.floor(Math.random() * 50000) + 100,
    forks: Math.floor(Math.random() * 5000) + 10,
    open_prs: Math.floor(Math.random() * 50) + 1,
    open_issues: Math.floor(Math.random() * 100) + 5,
    contributors: Math.floor(Math.random() * 200) + 5,
    last_activity: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    is_pinned: i < 2,
    avatar_url: `https://github.com/${owners[i % owners.length]}.png`,
    html_url: `https://github.com/${owners[i % owners.length]}/project-${i + 1}`,
  }));
};

const sampleRepositories = generateRepositories(10);

const meta = {
  title: 'Features/Workspace/RepositoryList',
  component: RepositoryList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A sortable, searchable table component for displaying workspace repositories with actions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    repositories: {
      control: 'object',
      description: 'Array of repository objects to display',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading skeleton',
    },
    showActions: {
      control: 'boolean',
      description: 'Show action dropdown menu',
    },
    emptyMessage: {
      control: 'text',
      description: 'Message to show when no repositories',
    },
  },
} satisfies Meta<typeof RepositoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for stateful interactions
const InteractiveWrapper = ({ 
  initialRepos = sampleRepositories,
  showActions = true,
}: { 
  initialRepos?: Repository[];
  showActions?: boolean;
}) => {
  const [repositories, setRepositories] = useState(initialRepos);
  
  const handlePinToggle = (repo: Repository) => {
    setRepositories(repos => 
      repos.map(r => 
        r.id === repo.id 
          ? { ...r, is_pinned: !r.is_pinned }
          : r
      )
    );
    toast.success(
      repo.is_pinned 
        ? `Unpinned ${repo.full_name}` 
        : `Pinned ${repo.full_name}`
    );
  };
  
  const handleRemove = (repo: Repository) => {
    setRepositories(repos => repos.filter(r => r.id !== repo.id));
    toast.success(`Removed ${repo.full_name} from workspace`);
  };
  
  const handleClick = (repo: Repository) => {
    toast.info(`Navigating to /${repo.owner}/${repo.name}`);
    console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
  };
  
  return (
    <RepositoryList
      repositories={repositories}
      onRepositoryClick={handleClick}
      onPinToggle={handlePinToggle}
      onRemove={handleRemove}
      showActions={showActions}
    />
  );
};

export const Default: Story = {
  args: {
    repositories: sampleRepositories.slice(0, 5),
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
};

export const WithManyRepositories: Story = {
  args: {
    repositories: generateRepositories(20),
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repository list with many items to demonstrate scrolling and performance',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    repositories: [],
    emptyMessage: 'No repositories in this workspace yet. Add your first repository to get started!',
  },
};

export const Loading: Story = {
  args: {
    repositories: [],
    loading: true,
  },
};

export const WithoutActions: Story = {
  args: {
    repositories: sampleRepositories.slice(0, 5),
    showActions: false,
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} showActions={false} />,
  parameters: {
    docs: {
      description: {
        story: 'Repository list without action dropdown menus',
      },
    },
  },
};

export const PinnedRepositories: Story = {
  args: {
    repositories: [
      ...sampleRepositories.slice(0, 2).map(r => ({ ...r, is_pinned: true })),
      ...sampleRepositories.slice(2, 5).map(r => ({ ...r, is_pinned: false })),
    ],
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repositories with pinned items shown at the top',
      },
    },
  },
};

export const SearchDemo: Story = {
  render: () => {
    const manyRepos = generateRepositories(15);
    // Add some specific repos for search testing
    manyRepos[0] = { ...manyRepos[0], full_name: 'react/react', name: 'react', description: 'A JavaScript library for building user interfaces' };
    manyRepos[1] = { ...manyRepos[1], full_name: 'vuejs/vue', name: 'vue', description: 'Progressive JavaScript framework' };
    manyRepos[2] = { ...manyRepos[2], full_name: 'angular/angular', name: 'angular', description: 'Platform for building mobile and desktop web applications' };
    
    return <InteractiveWrapper initialRepos={manyRepos} />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Try searching for "react", "vue", or "angular" to see the filtering in action',
      },
    },
  },
};

export const VariousLanguages: Story = {
  args: {
    repositories: [
      { ...sampleRepositories[0], language: 'TypeScript', stars: 45230 },
      { ...sampleRepositories[1], language: 'Python', stars: 32100 },
      { ...sampleRepositories[2], language: 'Go', stars: 28900 },
      { ...sampleRepositories[3], language: 'Rust', stars: 15600 },
      { ...sampleRepositories[4], language: 'Java', stars: 12300 },
      { ...sampleRepositories[5], language: undefined, stars: 8900 },
    ],
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repositories with different programming languages',
      },
    },
  },
};

export const RecentActivity: Story = {
  args: {
    repositories: [
      { ...sampleRepositories[0], last_activity: new Date().toISOString() },
      { ...sampleRepositories[1], last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { ...sampleRepositories[2], last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { ...sampleRepositories[3], last_activity: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
      { ...sampleRepositories[4], last_activity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() },
      { ...sampleRepositories[5], last_activity: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repositories sorted by recent activity, showing relative time formatting',
      },
    },
  },
};

export const HighActivityRepos: Story = {
  args: {
    repositories: [
      { ...sampleRepositories[0], open_prs: 1420, contributors: 5230, stars: 98500 },
      { ...sampleRepositories[1], open_prs: 890, contributors: 3420, stars: 67200 },
      { ...sampleRepositories[2], open_prs: 760, contributors: 2890, stars: 45100 },
      { ...sampleRepositories[3], open_prs: 120, contributors: 450, stars: 8900 },
      { ...sampleRepositories[4], open_prs: 30, contributors: 120, stars: 1200 },
    ],
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repositories with varying levels of activity and engagement',
      },
    },
  },
};

export const LongDescriptions: Story = {
  args: {
    repositories: sampleRepositories.slice(0, 5).map(repo => ({
      ...repo,
      description: 'This is a very long description that demonstrates how the component handles text overflow and truncation in the repository list. It should be truncated with an ellipsis when it exceeds the available space in the table cell.',
    })),
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    docs: {
      description: {
        story: 'Repositories with long descriptions to test text truncation',
      },
    },
  },
};

export const LoadingSkeleton: Story = {
  render: () => <RepositoryListSkeleton />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton component for repository list',
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    repositories: sampleRepositories.slice(0, 3),
  },
  render: (args) => <InteractiveWrapper initialRepos={args.repositories} />,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Repository list on mobile viewport',
      },
    },
  },
};

export const ComparisonDemo: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">With Data</h3>
        <InteractiveWrapper initialRepos={sampleRepositories.slice(0, 3)} />
      </div>
      
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Loading State</h3>
        <RepositoryListSkeleton />
      </div>
      
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Empty State</h3>
        <RepositoryList 
          repositories={[]} 
          emptyMessage="Start by adding repositories to your workspace"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of different repository list states',
      },
    },
  },
};