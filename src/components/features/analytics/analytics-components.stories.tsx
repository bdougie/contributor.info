import type { Meta, StoryObj } from '@storybook/react';
import { ContributorImpactCard, ContributorImpactCardCompact } from './ContributorImpactCard';
import { CommunitySuccessChart } from './CommunitySuccessChart';
import type { AIEnhancedContributorProfile, CommunitySuccessMetrics } from '@/lib/analytics/ai-contributor-analyzer';
import { AreaChart, LineChart, BarChart, DonutChart } from '@/components/ui/charts';

// Mock data generators
const createMockProfile = (overrides: Partial<AIEnhancedContributorProfile> = {}): AIEnhancedContributorProfile => ({
  login: 'octocat',
  avatar_url: 'https://github.com/octocat.png',
  github_id: 583231,
  classification: {
    login: 'octocat',
    contributorType: 'outsider',
    trustLevel: 'trusted',
    classificationConfidence: 0.85,
    insiderSignals: {
      hasCompanyEmail: false,
      commitsDuringBusinessHours: 45,
      accessToPrivateRepos: false,
      organizationMember: false,
      employeeGitConfig: false,
    },
    trustIndicators: {
      monthsActive: 18,
      codeReviewParticipation: 75,
      maintainerNominations: 2,
      securitySensitiveCommits: 8,
      communityReputation: 88,
    },
  },
  consistency: {
    login: 'octocat',
    consistencyScore: 82,
    activityPattern: {
      weeklyCommits: [3, 5, 2, 7, 4, 6, 3],
      monthlyTrend: 'increasing',
      longestActiveStreak: 23,
      longestInactiveStreak: 4,
      averageCommitsPerWeek: 4.3,
      standardDeviation: 1.8,
    },
    reliabilityMetrics: {
      averageResponseTime: 6.5,
      commitmentKeepingRate: 92,
      codeQualityConsistency: 87,
    },
  },
  aiInsights: {
    impactNarrative: {
      type: 'impact',
      narrative: 'This contributor has demonstrated exceptional impact through consistent high-quality contributions and strong community engagement. They have successfully mentored newcomers, contributed to critical infrastructure improvements, and maintained excellent code review practices that have elevated the overall project quality.',
      confidence: 0.89,
      evidence: [
        'Maintained 92% PR merge rate with complex technical contributions',
        'Provided thoughtful code reviews that improved team practices',
        'Led initiative that reduced build times by 40%'
      ],
      recommendations: [
        'Consider nominating for maintainer status',
        'Invite to technical decision-making discussions',
        'Showcase their work in community spotlights'
      ],
      aiModel: 'gpt-4o-mini',
      generated_at: new Date('2024-01-15T10:30:00Z'),
    },
    achievementStory: null,
    growthPotential: null,
  },
  overallScore: 86,
  impactLevel: 'rising-star',
  celebrationPriority: 'high',
  lastAnalyzed: new Date('2024-01-15T10:30:00Z'),
  aiConfidence: 0.9,
  ...overrides,
});

const createMockCommunityMetrics = (): CommunitySuccessMetrics => ({
  totalContributors: 156,
  newContributorsThisMonth: 12,
  activeContributors: 89,
  championContributors: 8,
  risingStars: 15,
  crossPollination: 72,
  mentorshipActivity: 65,
  communityEngagement: 78,
  prSuccessRate: 87,
  averageTimeToFirstResponse: 6.5,
  communityHealthScore: 84,
  diversityIndex: 76,
  communityNarrative: {
    type: 'success_story',
    narrative: 'This community has demonstrated remarkable growth and engagement over the past quarter. The 12% increase in active contributors, combined with strong mentorship activity and cross-collaboration, indicates a healthy and sustainable development ecosystem.',
    confidence: 0.89,
    evidence: [
      'Active contributor count grew 18% month-over-month',
      'Mentorship program resulted in 85% newcomer retention rate',
      'Cross-team collaboration increased by 25% through review participation'
    ],
    recommendations: [
      'Expand mentorship program to accommodate growing newcomer interest',
      'Create contributor spotlight program to celebrate achievements'
    ],
    aiModel: 'gpt-4o-mini',
    generated_at: new Date(),
  },
  successStories: [],
  growthOpportunities: [
    'Implement automated contributor onboarding to streamline newcomer experience',
    'Create cross-functional teams to increase knowledge sharing',
    'Establish contributor recognition program with public celebrations'
  ],
});

const meta: Meta = {
  title: 'Features/Analytics/Complete Dashboard',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete analytics dashboard showcasing AI-powered contributor insights, community success metrics, and interactive charts.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// Complete dashboard with all components
export const CompleteDashboard: Story = {
  render: () => {
    const profiles = [
      createMockProfile({
        login: 'champion-dev',
        impactLevel: 'champion',
        overallScore: 95,
        celebrationPriority: 'high',
      }),
      createMockProfile({
        login: 'rising-star-dev',
        impactLevel: 'rising-star',
        overallScore: 82,
        celebrationPriority: 'high',
      }),
      createMockProfile({
        login: 'solid-contributor',
        impactLevel: 'solid-contributor',
        overallScore: 68,
        celebrationPriority: 'medium',
      }),
      createMockProfile({
        login: 'newcomer-dev',
        impactLevel: 'newcomer',
        overallScore: 45,
        celebrationPriority: 'low',
      }),
    ];

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Advanced Analytics Dashboard
            </h1>
            <p className="text-lg text-gray-600">
              AI-powered contributor insights and community success metrics
            </p>
          </div>

          {/* Community Success Chart */}
          <div className="mb-8">
            <CommunitySuccessChart
              metrics={createMockCommunityMetrics()}
              timeRange="60d"
            />
          </div>

          {/* Top Contributors Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Top Contributors
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {profiles.slice(0, 2).map((profile, index) => (
                <ContributorImpactCard
                  key={profile.login}
                  profile={profile}
                  rank={index + 1}
                  showFullInsights={true}
                />
              ))}
            </div>
          </div>

          {/* All Contributors Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              All Contributors
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {profiles.map((profile, index) => (
                <ContributorImpactCardCompact
                  key={profile.login}
                  profile={profile}
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Chart showcase with all chart types
export const ChartShowcase: Story = {
  render: () => {
    // Generate sample data
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleDateString('en', { month: 'short' }),
      contributors: Math.floor(Math.random() * 50) + 100 + i * 5,
      prs: Math.floor(Math.random() * 200) + 300 + i * 10,
      issues: Math.floor(Math.random() * 100) + 150 + i * 3,
    }));

    const contributorTypeData = [
      { name: 'External', value: 65, color: '#3b82f6' },
      { name: 'Internal', value: 25, color: '#10b981' },
      { name: 'Hybrid', value: 10, color: '#f59e0b' },
    ];

    const weeklyActivityData = Array.from({ length: 8 }, (_, i) => ({
      week: `Week ${i + 1}`,
      commits: Math.floor(Math.random() * 100) + 50,
      reviews: Math.floor(Math.random() * 60) + 30,
      issues: Math.floor(Math.random() * 40) + 20,
    }));

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analytics Charts Showcase
            </h1>
            <p className="text-lg text-gray-600">
              Interactive charts powered by uPlot with real-time data
            </p>
          </div>

          {/* Area Chart - Growth Trends */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Community Growth (Area Chart)</h2>
            <div className="h-64">
              <AreaChart
                data={{
                  labels: monthlyData.map(d => d.month),
                  datasets: [
                    {
                      label: 'Contributors',
                      data: monthlyData.map(d => d.contributors),
                      color: '#3b82f6',
                      fillOpacity: 0.3
                    },
                    {
                      label: 'Pull Requests',
                      data: monthlyData.map(d => d.prs),
                      color: '#10b981',
                      fillOpacity: 0.2
                    }
                  ]
                }}
                height={256}
                showLegend={true}
                showGrid={true}
                xAxisLabel="Month"
                yAxisLabel="Count"
              />
            </div>
          </div>

          {/* Line Chart - Activity Trends */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Weekly Activity (Line Chart)</h2>
            <div className="h-64">
              <LineChart
                data={{
                  labels: weeklyActivityData.map(d => d.week),
                  datasets: [
                    {
                      label: 'Commits',
                      data: weeklyActivityData.map(d => d.commits),
                      color: '#8b5cf6'
                    },
                    {
                      label: 'Reviews',
                      data: weeklyActivityData.map(d => d.reviews),
                      color: '#ef4444'
                    },
                    {
                      label: 'Issues',
                      data: weeklyActivityData.map(d => d.issues),
                      color: '#f59e0b'
                    }
                  ]
                }}
                height={256}
                showLegend={true}
                showGrid={true}
              />
            </div>
          </div>

          {/* Bar Chart - Monthly Comparison */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Monthly Activity (Bar Chart)</h2>
            <div className="h-64">
              <BarChart
                data={{
                  labels: monthlyData.slice(0, 6).map(d => d.month),
                  datasets: [
                    {
                      label: 'Contributors',
                      data: monthlyData.slice(0, 6).map(d => d.contributors),
                      color: '#3b82f6'
                    },
                    {
                      label: 'Pull Requests',
                      data: monthlyData.slice(0, 6).map(d => Math.floor(d.prs / 10)),
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

          {/* Donut Chart - Contributor Types */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Contributor Distribution (Donut Chart)</h2>
            <div className="h-64 flex justify-center">
              <DonutChart
                data={contributorTypeData}
                innerRadius={60}
                outerRadius={120}
                showLegend={true}
                showLabels={true}
              />
            </div>
          </div>

          {/* Combined Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Quick Trends</h3>
              <div className="h-48">
                <LineChart
                  data={{
                    labels: weeklyActivityData.slice(0, 4).map(d => d.week),
                    datasets: [
                      {
                        label: 'Activity Score',
                        data: weeklyActivityData.slice(0, 4).map(d => d.commits + d.reviews),
                        color: '#8b5cf6'
                      }
                    ]
                  }}
                  height={192}
                  showLegend={false}
                  showGrid={true}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Contributor Mix</h3>
              <div className="h-48 flex justify-center">
                <DonutChart
                  data={contributorTypeData}
                  innerRadius={40}
                  outerRadius={80}
                  showLegend={true}
                  showLabels={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// Mobile responsive view
export const MobileView: Story = {
  render: () => {
    const profiles = [
      createMockProfile({
        login: 'mobile-champion',
        impactLevel: 'champion',
        overallScore: 95,
      }),
      createMockProfile({
        login: 'mobile-star',
        impactLevel: 'rising-star',
        overallScore: 82,
      }),
    ];

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Mobile Analytics
          </h1>
          
          <CommunitySuccessChart
            metrics={createMockCommunityMetrics()}
            timeRange="30d"
            className="w-full"
          />
          
          <div className="space-y-3">
            {profiles.map((profile, index) => (
              <ContributorImpactCardCompact
                key={profile.login}
                profile={profile}
                rank={index + 1}
              />
            ))}
          </div>
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

// Performance test with many contributors
export const LargeDataset: Story = {
  render: () => {
    const profiles = Array.from({ length: 20 }, (_, i) => 
      createMockProfile({
        login: `contributor-${i + 1}`,
        overallScore: Math.floor(Math.random() * 40) + 60,
        impactLevel: i < 3 ? 'champion' : i < 10 ? 'rising-star' : 'solid-contributor',
        celebrationPriority: i < 5 ? 'high' : i < 12 ? 'medium' : 'low'
      })
    );

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Large Dataset Performance Test
          </h1>
          <p className="text-gray-600 mb-6">
            Testing with {profiles.length} contributors
          </p>
          
          <CommunitySuccessChart
            metrics={createMockCommunityMetrics()}
            timeRange="90d"
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {profiles.map((profile, index) => (
              <ContributorImpactCardCompact
                key={profile.login}
                profile={profile}
                rank={index + 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
};