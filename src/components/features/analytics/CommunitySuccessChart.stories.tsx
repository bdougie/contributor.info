import type { Meta, StoryObj } from '@storybook/react';
import { CommunitySuccessChart } from './CommunitySuccessChart';
import type { CommunitySuccessMetrics } from '@/lib/analytics/ai-contributor-analyzer';

// Mock community success metrics
const createMockMetrics = (overrides: Partial<CommunitySuccessMetrics> = {}): CommunitySuccessMetrics => ({
  // Growth indicators
  totalContributors: 156,
  newContributorsThisMonth: 12,
  activeContributors: 89,
  championContributors: 8,
  risingStars: 15,
  
  // Collaboration metrics
  crossPollination: 72,
  mentorshipActivity: 65,
  communityEngagement: 78,
  
  // Success indicators
  prSuccessRate: 87,
  averageTimeToFirstResponse: 6.5,
  communityHealthScore: 84,
  diversityIndex: 76,
  
  // AI insights
  communityNarrative: {
    type: 'success_story',
    narrative: 'This community has demonstrated remarkable growth and engagement over the past quarter. The 12% increase in active contributors, combined with strong mentorship activity and cross-collaboration, indicates a healthy and sustainable development ecosystem. The high PR success rate of 87% reflects both quality contributions and effective review processes.',
    confidence: 0.89,
    evidence: [
      'Active contributor count grew 18% month-over-month',
      'Mentorship program resulted in 85% newcomer retention rate',
      'Cross-team collaboration increased by 25% through review participation',
      'Community health score consistently above 80 for 3 months'
    ],
    recommendations: [
      'Expand mentorship program to accommodate growing newcomer interest',
      'Create contributor spotlight program to celebrate achievements',
      'Establish technical working groups to maintain collaboration momentum'
    ],
    aiModel: 'gpt-4o-mini',
    generated_at: new Date('2024-01-15T10:30:00Z'),
  },
  successStories: [],
  growthOpportunities: [
    'Implement automated contributor onboarding to streamline newcomer experience',
    'Create cross-functional teams to increase knowledge sharing',
    'Establish contributor recognition program with public celebrations',
    'Develop community-driven feature roadmap to increase engagement'
  ],
  ...overrides,
});

const meta: Meta<typeof CommunitySuccessChart> = {
  title: 'Features/Analytics/CommunitySuccessChart',
  component: CommunitySuccessChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A comprehensive dashboard component that displays community success metrics, growth trends, and AI-generated insights about community health and engagement.',
      },
    },
  },
  argTypes: {
    timeRange: {
      control: { type: 'select' },
      options: ['30d', '60d', '90d'],
      description: 'Time range for trend analysis',
    },
    onTimeRangeChange: {
      action: 'timeRangeChanged',
      description: 'Callback when time range is changed',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommunitySuccessChart>;

// Primary story - Thriving community
export const ThrivingCommunity: Story = {
  args: {
    metrics: createMockMetrics(),
    timeRange: '60d',
  },
};

// High growth community
export const HighGrowth: Story = {
  args: {
    metrics: createMockMetrics({
      totalContributors: 284,
      newContributorsThisMonth: 28,
      activeContributors: 167,
      championContributors: 15,
      risingStars: 32,
      crossPollination: 85,
      mentorshipActivity: 78,
      communityEngagement: 92,
      prSuccessRate: 91,
      averageTimeToFirstResponse: 4.2,
      communityHealthScore: 94,
      diversityIndex: 88,
      communityNarrative: {
        type: 'success_story',
        narrative: 'This community is experiencing exceptional growth with outstanding metrics across all categories. The 28 new contributors this month represents the highest growth rate in the project\'s history, while maintaining extremely high quality standards with a 91% PR success rate. The community has successfully scaled its mentorship and collaboration systems.',
        confidence: 0.94,
        evidence: [
          'Record-breaking 28 new contributors this month with 95% retention',
          'Mentorship program scaled to 78% activity rate without quality loss',
          '91% PR success rate maintained despite 40% volume increase',
          'Community health score reached all-time high of 94'
        ],
        recommendations: [
          'Document scaling practices as playbook for other open source projects',
          'Consider establishing contributor conference or major community event',
          'Create advanced contributor track for champions wanting deeper involvement'
        ],
        aiModel: 'gpt-4o',
        generated_at: new Date(),
      },
      growthOpportunities: [
        'Establish annual contributor conference to celebrate community',
        'Create advanced technical working groups for experienced contributors',
        'Develop community-led initiative program with funding support',
        'Launch open source mentorship certification program'
      ]
    }),
    timeRange: '90d',
  },
};

// Steady but healthy community
export const SteadyGrowth: Story = {
  args: {
    metrics: createMockMetrics({
      totalContributors: 89,
      newContributorsThisMonth: 5,
      activeContributors: 42,
      championContributors: 3,
      risingStars: 8,
      crossPollination: 65,
      mentorshipActivity: 58,
      communityEngagement: 71,
      prSuccessRate: 82,
      averageTimeToFirstResponse: 8.3,
      communityHealthScore: 76,
      diversityIndex: 69,
      communityNarrative: {
        type: 'success_story',
        narrative: 'This community maintains steady, sustainable growth with solid fundamentals in place. While growth is moderate, the quality of contributions and community engagement remains consistently strong. The established contributor base provides excellent stability and mentorship for newcomers.',
        confidence: 0.81,
        evidence: [
          'Consistent contributor retention rate of 78% over 6 months',
          'Strong core of 3 champion contributors providing stable leadership',
          'Steady PR success rate indicates good quality control processes',
          'Mentorship activity maintaining healthy onboarding pipeline'
        ],
        recommendations: [
          'Focus on converting active contributors to champions through recognition',
          'Implement targeted outreach to increase newcomer pipeline',
          'Celebrate steady achievements to maintain community morale'
        ],
        aiModel: 'gpt-4o-mini',
        generated_at: new Date(),
      },
      growthOpportunities: [
        'Launch targeted outreach campaign to grow contributor base',
        'Create contributor advancement program with clear progression paths',
        'Improve documentation to reduce onboarding friction'
      ]
    }),
    timeRange: '30d',
  },
};

// Early stage community
export const EarlyStage: Story = {
  args: {
    metrics: createMockMetrics({
      totalContributors: 23,
      newContributorsThisMonth: 8,
      activeContributors: 15,
      championContributors: 1,
      risingStars: 5,
      crossPollination: 45,
      mentorshipActivity: 35,
      communityEngagement: 62,
      prSuccessRate: 78,
      averageTimeToFirstResponse: 12.5,
      communityHealthScore: 68,
      diversityIndex: 54,
      communityNarrative: {
        type: 'success_story',
        narrative: 'This emerging community shows promising signs of growth with strong newcomer interest. While still developing its collaboration patterns and processes, the high ratio of new contributors indicates strong project appeal. The single champion contributor is effectively managing the growing community.',
        confidence: 0.76,
        evidence: [
          '35% of contributors joined this month showing strong project interest',
          'Rising star identification rate of 22% indicates good growth potential',
          'Single champion effectively managing community growth and quality',
          'Response times improving as processes become more established'
        ],
        recommendations: [
          'Prioritize developing more champion contributors to support growth',
          'Establish clear contributor guidelines and onboarding processes',
          'Create structured mentorship program to improve retention'
        ],
        aiModel: 'gpt-4o-mini',
        generated_at: new Date(),
      },
      growthOpportunities: [
        'Develop comprehensive contributor onboarding program',
        'Establish community guidelines and best practices documentation',
        'Create mentor matching program for newcomers',
        'Set up regular community check-ins and feedback sessions'
      ]
    }),
    timeRange: '30d',
  },
};

// Community without AI insights (fallback)
export const WithoutAI: Story = {
  args: {
    metrics: createMockMetrics({
      communityNarrative: null,
      successStories: [],
    }),
    timeRange: '60d',
  },
};

// Detailed view with all insights expanded
export const DetailedView: Story = {
  args: {
    metrics: createMockMetrics({
      // High engagement metrics to show all features
      totalContributors: 342,
      newContributorsThisMonth: 24,
      activeContributors: 198,
      championContributors: 18,
      risingStars: 28,
      crossPollination: 89,
      mentorshipActivity: 82,
      communityEngagement: 91,
      prSuccessRate: 93,
      averageTimeToFirstResponse: 3.8,
      communityHealthScore: 96,
      diversityIndex: 85,
      
      successStories: [
        {
          type: 'achievement',
          narrative: '@star-contributor achieved champion status this month after 18 months of exceptional contributions and community leadership.',
          confidence: 0.92,
          evidence: ['Led 3 major initiatives', 'Mentored 12 newcomers', '96% PR approval rate'],
          recommendations: ['Feature in community spotlight', 'Invite to technical steering committee'],
          aiModel: 'gpt-4o-mini',
          generated_at: new Date(),
        }
      ],
      
      growthOpportunities: [
        'Launch annual contributor summit to celebrate achievements and plan roadmap',
        'Establish technical working groups for specialized domain expertise',
        'Create contributor advancement program with clear career progression',
        'Implement automated recognition system for milestone achievements',
        'Develop partnerships with educational institutions for student contributors',
        'Create contributor emeritus program for long-term recognition'
      ]
    }),
    timeRange: '90d',
  },
};

// Mobile responsive view
export const MobileView: Story = {
  args: {
    metrics: createMockMetrics(),
    timeRange: '30d',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// Different time ranges comparison
export const TimeRangeComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">30 Days</h3>
        <CommunitySuccessChart 
          metrics={createMockMetrics({
            newContributorsThisMonth: 8,
            activeContributors: 45,
            communityHealthScore: 82
          })}
          timeRange="30d"
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">60 Days</h3>
        <CommunitySuccessChart 
          metrics={createMockMetrics({
            newContributorsThisMonth: 15,
            activeContributors: 67,
            communityHealthScore: 84
          })}
          timeRange="60d"
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">90 Days</h3>
        <CommunitySuccessChart 
          metrics={createMockMetrics({
            newContributorsThisMonth: 22,
            activeContributors: 89,
            communityHealthScore: 87
          })}
          timeRange="90d"
        />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};