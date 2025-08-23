import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ContributorsList, type Contributor } from './ContributorsList';

const meta: Meta<typeof ContributorsList> = {
  title: 'Features/Workspace/ContributorsList',
  component: ContributorsList,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    onTrackContributor: { action: 'track-contributor' },
    onUntrackContributor: { action: 'untrack-contributor' },
    onContributorClick: { action: 'contributor-clicked' },
    onAddContributor: { action: 'add-contributor' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock contributor data
const generateMockContributors = (count: number): Contributor[] => {
  const names = [
    'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Eve Anderson',
    'Frank Miller', 'Grace Hopper', 'Henry Ford', 'Iris West', 'Jack Ryan',
    'Kate Bishop', 'Leo Valdez', 'Maya Lopez', 'Nathan Drake', 'Olivia Pope',
  ];

  const bios = [
    'Full-stack developer passionate about open source',
    'Building the future of web development',
    'TypeScript enthusiast and React contributor',
    'Making the web more accessible, one PR at a time',
    'DevOps engineer and cloud architect',
    'Open source maintainer and community builder',
    'Frontend specialist with a love for design systems',
    'Backend wizard solving complex distributed systems',
    'Security researcher and vulnerability hunter',
    'Performance optimization expert',
  ];

  const companies = [
    'Microsoft', 'Google', 'Meta', 'Amazon', 'Apple',
    'Netflix', 'Spotify', 'Vercel', 'GitHub', 'GitLab',
  ];

  const locations = [
    'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA',
    'London, UK', 'Berlin, Germany', 'Tokyo, Japan', 'Toronto, Canada', 'Sydney, Australia',
  ];

  return Array.from({ length: count }, (_, i) => {
    const trend = Math.floor(Math.random() * 201) - 100; // -100 to +100
    const username = names[i % names.length].toLowerCase().replace(' ', '');
    
    return {
      id: `contributor-${i + 1}`,
      username,
      avatar_url: `https://avatars.githubusercontent.com/u/${i + 1}?v=4`,
      name: names[i % names.length],
      bio: bios[i % bios.length],
      company: companies[Math.floor(Math.random() * companies.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      contributions: {
        commits: Math.floor(Math.random() * 500) + 10,
        pull_requests: Math.floor(Math.random() * 100) + 5,
        issues: Math.floor(Math.random() * 50) + 2,
        reviews: Math.floor(Math.random() * 200) + 10,
        comments: Math.floor(Math.random() * 300) + 15,
      },
      stats: {
        total_contributions: Math.floor(Math.random() * 1000) + 50,
        contribution_trend: trend,
        last_active: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        repositories_contributed: Math.floor(Math.random() * 20) + 1,
      },
    };
  });
};

// Wrapper component for state management
function ContributorsListWrapper(props: Omit<Parameters<typeof ContributorsList>[0], 'trackedContributors'>) {
  const [trackedContributors, setTrackedContributors] = useState<string[]>([]);

  const handleTrack = (id: string) => {
    setTrackedContributors(prev => [...prev, id]);
    props.onTrackContributor?.(id);
  };

  const handleUntrack = (id: string) => {
    setTrackedContributors(prev => prev.filter(c => c !== id));
    props.onUntrackContributor?.(id);
  };

  return (
    <ContributorsList
      {...props}
      trackedContributors={trackedContributors}
      onTrackContributor={handleTrack}
      onUntrackContributor={handleUntrack}
    />
  );
}

export const Default: Story = {
  render: (args) => (
    <ContributorsListWrapper
      {...args}
      contributors={generateMockContributors(12)}
    />
  ),
};

export const ListView: Story = {
  render: (args) => (
    <ContributorsListWrapper
      {...args}
      contributors={generateMockContributors(10)}
      view="list"
    />
  ),
};

export const WithTrackedContributors: Story = {
  render: (args) => {
    const contributors = generateMockContributors(12);
    const Component = () => {
      const [trackedContributors, setTrackedContributors] = useState<string[]>([
        'contributor-1', 'contributor-3', 'contributor-5', 'contributor-7'
      ]);

      const handleTrack = (id: string) => {
        setTrackedContributors(prev => [...prev, id]);
      };

      const handleUntrack = (id: string) => {
        setTrackedContributors(prev => prev.filter(c => c !== id));
      };

      return (
        <ContributorsList
          {...args}
          contributors={contributors}
          trackedContributors={trackedContributors}
          onTrackContributor={handleTrack}
          onUntrackContributor={handleUntrack}
        />
      );
    };
    return <Component />;
  },
};

export const Empty: Story = {
  args: {
    contributors: [],
  },
};

export const Loading: Story = {
  args: {
    contributors: [],
    loading: true,
  },
};

export const FewContributors: Story = {
  render: (args) => (
    <ContributorsListWrapper
      {...args}
      contributors={generateMockContributors(3)}
    />
  ),
};

export const ManyContributors: Story = {
  render: (args) => (
    <ContributorsListWrapper
      {...args}
      contributors={generateMockContributors(30)}
    />
  ),
};

export const TopPerformers: Story = {
  render: (args) => {
    const contributors = generateMockContributors(12).map(c => ({
      ...c,
      contributions: {
        commits: Math.floor(Math.random() * 2000) + 1000,
        pull_requests: Math.floor(Math.random() * 500) + 200,
        issues: Math.floor(Math.random() * 200) + 50,
        reviews: Math.floor(Math.random() * 800) + 300,
        comments: Math.floor(Math.random() * 1000) + 500,
      },
      stats: {
        ...c.stats,
        contribution_trend: Math.floor(Math.random() * 100) + 20,
        repositories_contributed: Math.floor(Math.random() * 30) + 15,
      },
    }));

    return (
      <ContributorsListWrapper
        {...args}
        contributors={contributors}
      />
    );
  },
};

export const DecliningContributors: Story = {
  render: (args) => {
    const contributors = generateMockContributors(12).map(c => ({
      ...c,
      stats: {
        ...c.stats,
        contribution_trend: -Math.floor(Math.random() * 50) - 10,
      },
    }));

    return (
      <ContributorsListWrapper
        {...args}
        contributors={contributors}
      />
    );
  },
};