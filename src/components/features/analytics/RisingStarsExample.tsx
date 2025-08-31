import { RisingStarsChart } from './RisingStarsChart';
import type { RisingStarsData } from '@/lib/analytics/rising-stars-data';

// Example component for testing the Rising Stars chart
export function RisingStarsExample() {
  // Mock data for demonstration
  const mockData: RisingStarsData[] = [
    {
      id: 'rising-stars',
      data: [
        {
          x: 45, // commits
          y: 28, // PRs + issues
          size: 80, // velocity score
          contributor: {
            login: 'alice-dev',
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
            github_id: 12345,
            commits: 45,
            pullRequests: 20,
            issues: 8,
            totalActivity: 73,
            velocityScore: 12.5,
            growthRate: 150,
            firstContributionDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            lastContributionDate: new Date().toISOString(),
            contributionSpan: 60,
            isNewContributor: true,
            isRisingStar: true,
          },
        },
        {
          x: 30,
          y: 15,
          size: 50,
          contributor: {
            login: 'bob-contributor',
            avatar_url: 'https://avatars.githubusercontent.com/u/23456',
            github_id: 23456,
            commits: 30,
            pullRequests: 12,
            issues: 3,
            totalActivity: 45,
            velocityScore: 7.2,
            growthRate: 25,
            firstContributionDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
            lastContributionDate: new Date().toISOString(),
            contributionSpan: 180,
            isNewContributor: false,
            isRisingStar: false,
          },
        },
        {
          x: 15,
          y: 22,
          size: 65,
          contributor: {
            login: 'charlie-star',
            avatar_url: 'https://avatars.githubusercontent.com/u/34567',
            github_id: 34567,
            commits: 15,
            pullRequests: 18,
            issues: 4,
            totalActivity: 37,
            velocityScore: 9.8,
            growthRate: 200,
            firstContributionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastContributionDate: new Date().toISOString(),
            contributionSpan: 30,
            isNewContributor: true,
            isRisingStar: true,
          },
        },
      ],
    },
  ];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Rising Stars Chart Example</h1>
      <RisingStarsChart data={mockData} height={500} maxBubbles={50} />
    </div>
  );
}
