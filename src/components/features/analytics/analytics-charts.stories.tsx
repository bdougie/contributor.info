import type { Meta, StoryObj } from '@storybook/react';
import { AreaChart, LineChart, BarChart, DonutChart } from '@/components/ui/charts';

const meta: Meta = {
  title: 'Features/Analytics/Charts',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Analytics-specific chart configurations showing contributor data, community metrics, and trends.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// Contributor growth over time
export const ContributorGrowth: Story = {
  render: () => {
    const data = Array.from({ length: 12 }, (_, i) => {
      const baseContributors = 50 + i * 8;
      const baseActive = Math.floor(baseContributors * 0.6);
      const baseChampions = Math.floor(baseContributors * 0.08);
      
      return {
        month: new Date(2024, i, 1).toLocaleDateString('en', { month: 'short' }),
        total: baseContributors + Math.floor(Math.random() * 10),
        active: baseActive + Math.floor(Math.random() * 8),
        champions: baseChampions + Math.floor(Math.random() * 3),
        rising: Math.floor(baseActive * 0.2) + Math.floor(Math.random() * 4)
      };
    });

    return (
      <div className="w-full space-y-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Community Growth Timeline</h2>
          <p className="text-gray-600 mb-6">Track total contributors, active contributors, and rising stars over time</p>
          
          <div className="h-80">
            <AreaChart
              data={{
                labels: data.map(d => d.month),
                datasets: [
                  {
                    label: 'Total Contributors',
                    data: data.map(d => d.total),
                    color: '#3b82f6',
                    fillOpacity: 0.1
                  },
                  {
                    label: 'Active Contributors',
                    data: data.map(d => d.active),
                    color: '#10b981',
                    fillOpacity: 0.2
                  },
                  {
                    label: 'Rising Stars',
                    data: data.map(d => d.rising),
                    color: '#f59e0b',
                    fillOpacity: 0.3
                  }
                ]
              }}
              height={320}
              showLegend={true}
              showGrid={true}
              xAxisLabel="Month"
              yAxisLabel="Number of Contributors"
            />
          </div>
        </div>
      </div>
    );
  },
};

// PR velocity and success metrics
export const PRMetrics: Story = {
  render: () => {
    const weeklyData = Array.from({ length: 12 }, (_, i) => ({
      week: `W${i + 1}`,
      prs: Math.floor(Math.random() * 50) + 80,
      merged: Math.floor(Math.random() * 40) + 65,
      reviews: Math.floor(Math.random() * 60) + 90,
      avgTime: Math.random() * 24 + 12 // hours
    }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Weekly PR Volume</h3>
          <div className="h-64">
            <BarChart
              data={{
                labels: weeklyData.map(d => d.week),
                datasets: [
                  {
                    label: 'PRs Created',
                    data: weeklyData.map(d => d.prs),
                    color: '#3b82f6'
                  },
                  {
                    label: 'PRs Merged',
                    data: weeklyData.map(d => d.merged),
                    color: '#10b981'
                  }
                ]
              }}
              height={256}
              showLegend={true}
              showGrid={true}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Review Response Time</h3>
          <div className="h-64">
            <LineChart
              data={{
                labels: weeklyData.map(d => d.week),
                datasets: [
                  {
                    label: 'Avg Response Time (hours)',
                    data: weeklyData.map(d => Math.round(d.avgTime * 10) / 10),
                    color: '#8b5cf6'
                  },
                  {
                    label: 'Reviews Given',
                    data: weeklyData.map(d => Math.round(d.reviews / 5)), // Scale down for visibility
                    color: '#ec4899'
                  }
                ]
              }}
              height={256}
              showLegend={true}
              showGrid={true}
            />
          </div>
        </div>
      </div>
    );
  },
};

// Contributor distribution and diversity
export const ContributorDistribution: Story = {
  render: () => {
    const trustLevelData = [
      { name: 'Core', value: 8, color: '#dc2626' },
      { name: 'Trusted', value: 25, color: '#ea580c' },
      { name: 'Active', value: 45, color: '#ca8a04' },
      { name: 'Occasional', value: 52, color: '#65a30d' },
      { name: 'New', value: 26, color: '#0891b2' }
    ];

    const contributorTypeData = [
      { name: 'External', value: 78, color: '#3b82f6' },
      { name: 'Internal', value: 34, color: '#10b981' },
      { name: 'Hybrid', value: 12, color: '#f59e0b' }
    ];

    const impactLevelData = [
      { name: 'Champions', value: 12, color: '#fbbf24' },
      { name: 'Rising Stars', value: 28, color: '#3b82f6' },
      { name: 'Contributors', value: 65, color: '#10b981' },
      { name: 'Newcomers', value: 19, color: '#6b7280' }
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Trust Levels</h3>
          <div className="h-64 flex justify-center">
            <DonutChart
              data={trustLevelData}
              innerRadius={50}
              outerRadius={100}
              showLegend={true}
              showLabels={true}
            />
          </div>
          <div className="mt-4 text-center text-sm text-gray-600">
            Distribution of contributor trust levels
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Contributor Types</h3>
          <div className="h-64 flex justify-center">
            <DonutChart
              data={contributorTypeData}
              innerRadius={50}
              outerRadius={100}
              showLegend={true}
              showLabels={true}
            />
          </div>
          <div className="mt-4 text-center text-sm text-gray-600">
            Internal vs External contributor breakdown
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Impact Levels</h3>
          <div className="h-64 flex justify-center">
            <DonutChart
              data={impactLevelData}
              innerRadius={50}
              outerRadius={100}
              showLegend={true}
              showLabels={true}
            />
          </div>
          <div className="mt-4 text-center text-sm text-gray-600">
            Contributors by impact and celebration priority
          </div>
        </div>
      </div>
    );
  },
};

// Community health metrics over time
export const CommunityHealth: Story = {
  render: () => {
    const healthData = Array.from({ length: 24 }, (_, i) => {
      const base = 75 + Math.sin(i / 4) * 10;
      return {
        week: `W${i + 1}`,
        health: Math.max(60, Math.min(95, base + (Math.random() - 0.5) * 8)),
        engagement: Math.max(50, Math.min(90, base - 5 + (Math.random() - 0.5) * 10)),
        diversity: Math.max(40, Math.min(85, 65 + (Math.random() - 0.5) * 12)),
        mentorship: Math.max(30, Math.min(80, 55 + Math.sin(i / 6) * 15 + (Math.random() - 0.5) * 8))
      };
    });

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Community Health Trends</h2>
        <p className="text-gray-600 mb-6">
          Track key community health indicators over the past 6 months
        </p>
        
        <div className="h-80">
          <AreaChart
            data={{
              labels: healthData.map(d => d.week),
              datasets: [
                {
                  label: 'Overall Health Score',
                  data: healthData.map(d => Math.round(d.health)),
                  color: '#10b981',
                  fillOpacity: 0.2
                },
                {
                  label: 'Community Engagement',
                  data: healthData.map(d => Math.round(d.engagement)),
                  color: '#3b82f6',
                  fillOpacity: 0.1
                },
                {
                  label: 'Diversity Index',
                  data: healthData.map(d => Math.round(d.diversity)),
                  color: '#8b5cf6',
                  fillOpacity: 0.1
                },
                {
                  label: 'Mentorship Activity',
                  data: healthData.map(d => Math.round(d.mentorship)),
                  color: '#f59e0b',
                  fillOpacity: 0.15
                }
              ]
            }}
            height={320}
            showLegend={true}
            showGrid={true}
            xAxisLabel="Week"
            yAxisLabel="Score (0-100)"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(healthData[healthData.length - 1].health)}
            </div>
            <div className="text-sm text-gray-600">Current Health</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(healthData[healthData.length - 1].engagement)}
            </div>
            <div className="text-sm text-gray-600">Engagement</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(healthData[healthData.length - 1].diversity)}
            </div>
            <div className="text-sm text-gray-600">Diversity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {Math.round(healthData[healthData.length - 1].mentorship)}
            </div>
            <div className="text-sm text-gray-600">Mentorship</div>
          </div>
        </div>
      </div>
    );
  },
};

// Real-time activity dashboard
export const RealTimeActivity: Story = {
  render: () => {
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      commits: Math.floor(Math.random() * 30) + (i >= 9 && i <= 17 ? 20 : 5),
      prs: Math.floor(Math.random() * 15) + (i >= 9 && i <= 17 ? 10 : 2),
      reviews: Math.floor(Math.random() * 20) + (i >= 9 && i <= 17 ? 15 : 3),
      issues: Math.floor(Math.random() * 10) + (i >= 9 && i <= 17 ? 5 : 1)
    }));

    const topContributorsToday = [
      { name: 'alice-dev', commits: 12, prs: 3, reviews: 8 },
      { name: 'bob-coder', commits: 8, prs: 2, reviews: 12 },
      { name: 'charlie-ops', commits: 6, prs: 4, reviews: 6 },
      { name: 'diana-design', commits: 5, prs: 1, reviews: 10 },
      { name: 'eve-engineer', commits: 7, prs: 2, reviews: 5 }
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 24-hour activity chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">24-Hour Activity Pattern</h3>
          <div className="h-64">
            <AreaChart
              data={{
                labels: hourlyActivity.map(d => `${d.hour}:00`),
                datasets: [
                  {
                    label: 'Commits',
                    data: hourlyActivity.map(d => d.commits),
                    color: '#3b82f6',
                    fillOpacity: 0.3
                  },
                  {
                    label: 'PRs',
                    data: hourlyActivity.map(d => d.prs),
                    color: '#10b981',
                    fillOpacity: 0.2
                  },
                  {
                    label: 'Reviews',
                    data: hourlyActivity.map(d => d.reviews),
                    color: '#f59e0b',
                    fillOpacity: 0.2
                  }
                ]
              }}
              height={256}
              showLegend={true}
              showGrid={true}
            />
          </div>
        </div>

        {/* Top contributors today */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Today's Top Contributors</h3>
          <div className="space-y-3">
            {topContributorsToday.map((contributor, index) => (
              <div key={contributor.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{contributor.name}</div>
                    <div className="text-xs text-gray-500">
                      {contributor.commits + contributor.prs + contributor.reviews} total activities
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{contributor.commits}c</div>
                  <div className="text-xs text-gray-500">{contributor.prs}pr {contributor.reviews}rv</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

// Comprehensive analytics overview
export const AnalyticsOverview: Story = {
  render: () => {
    // Generate sample data for the overview
    const monthlyData = Array.from({ length: 6 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en', { month: 'short' }),
      contributors: 50 + i * 8 + Math.floor(Math.random() * 10),
      active: 30 + i * 5 + Math.floor(Math.random() * 8),
      rising: 5 + i * 2 + Math.floor(Math.random() * 4)
    }));

    const trustLevelData = [
      { name: 'Core', value: 8, color: '#dc2626' },
      { name: 'Trusted', value: 25, color: '#ea580c' },
      { name: 'Active', value: 45, color: '#ca8a04' },
      { name: 'Occasional', value: 52, color: '#65a30d' },
      { name: 'New', value: 26, color: '#0891b2' }
    ];

    const weeklyPRData = Array.from({ length: 8 }, (_, i) => ({
      week: `W${i + 1}`,
      prs: Math.floor(Math.random() * 50) + 80,
      merged: Math.floor(Math.random() * 40) + 65
    }));

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analytics Charts Collection
            </h1>
            <p className="text-lg text-gray-600">
              Complete collection of analytics visualizations for contributor insights
            </p>
          </div>

          {/* Contributor Growth */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Community Growth Timeline</h2>
            <div className="h-64">
              <AreaChart
                data={{
                  labels: monthlyData.map(d => d.month),
                  datasets: [
                    {
                      label: 'Total Contributors',
                      data: monthlyData.map(d => d.contributors),
                      color: '#3b82f6',
                      fillOpacity: 0.2
                    },
                    {
                      label: 'Active Contributors',
                      data: monthlyData.map(d => d.active),
                      color: '#10b981',
                      fillOpacity: 0.3
                    }
                  ]
                }}
                height={256}
                showLegend={true}
                showGrid={true}
              />
            </div>
          </div>

          {/* PR Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Weekly PR Volume</h3>
              <div className="h-64">
                <BarChart
                  data={{
                    labels: weeklyPRData.map(d => d.week),
                    datasets: [
                      {
                        label: 'PRs Created',
                        data: weeklyPRData.map(d => d.prs),
                        color: '#3b82f6'
                      },
                      {
                        label: 'PRs Merged',
                        data: weeklyPRData.map(d => d.merged),
                        color: '#10b981'
                      }
                    ]
                  }}
                  height={256}
                  showLegend={true}
                  showGrid={true}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Trust Level Distribution</h3>
              <div className="h-64 flex justify-center">
                <DonutChart
                  data={trustLevelData}
                  innerRadius={50}
                  outerRadius={100}
                  showLegend={true}
                  showLabels={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};