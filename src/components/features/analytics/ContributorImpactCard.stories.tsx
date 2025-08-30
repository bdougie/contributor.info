import type { Meta, StoryObj } from '@storybook/react';
import { ContributorImpactCard, ContributorImpactCardCompact } from './ContributorImpactCard';
import type { AIEnhancedContributorProfile } from '@/lib/analytics/ai-contributor-analyzer';

// Mock data for stories
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
    achievementStory: {
      type: 'achievement',
      narrative: 'Congratulations on reaching trusted contributor status! Your consistent 82% reliability score and 18 months of dedicated contributions have made a lasting impact. Your mentorship of newcomers and technical leadership in infrastructure improvements showcase the kind of community-first mindset that drives this project forward.',
      confidence: 0.91,
      evidence: [
        '82% consistency score over 18 months',
        'Trusted contributor status achieved',
        '88% community reputation score'
      ],
      recommendations: [
        'Share your success story to inspire others',
        'Consider speaking at community events'
      ],
      aiModel: 'gpt-4o-mini',
      generated_at: new Date('2024-01-15T10:30:00Z'),
    },
    growthPotential: null,
  },
  overallScore: 86,
  impactLevel: 'rising-star',
  celebrationPriority: 'high',
  lastAnalyzed: new Date('2024-01-15T10:30:00Z'),
  aiConfidence: 0.9,
  ...overrides,
});

const meta: Meta<typeof ContributorImpactCard> = {
  title: 'Features/Analytics/ContributorImpactCard',
  component: ContributorImpactCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A card component that displays contributor impact analysis with AI-generated insights, celebrating achievements and community contributions.',
      },
    },
  },
  argTypes: {
    rank: {
      control: { type: 'number', min: 1, max: 100 },
      description: 'Optional ranking number to display',
    },
    showFullInsights: {
      control: 'boolean',
      description: 'Whether to show complete AI insights or truncated version',
    },
    onViewProfile: {
      action: 'viewProfile',
      description: 'Callback when view profile button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContributorImpactCard>;

// Primary story - Champion contributor
export const Champion: Story = {
  args: {
    profile: createMockProfile({
      login: 'champion-dev',
      impactLevel: 'champion',
      overallScore: 95,
      celebrationPriority: 'high',
      classification: {
        ...createMockProfile().classification,
        login: 'champion-dev',
        trustLevel: 'core',
        contributorType: 'insider',
        classificationConfidence: 0.95,
        trustIndicators: {
          monthsActive: 36,
          codeReviewParticipation: 92,
          maintainerNominations: 5,
          securitySensitiveCommits: 15,
          communityReputation: 96,
        },
      },
      consistency: {
        ...createMockProfile().consistency,
        login: 'champion-dev',
        consistencyScore: 94,
      },
      aiInsights: {
        ...createMockProfile().aiInsights,
        impactNarrative: {
          type: 'impact',
          narrative: 'This champion contributor has been the backbone of the project for over 3 years, consistently delivering high-impact features and maintaining exceptional code quality. Their leadership in architectural decisions and mentorship of the community has been instrumental in the project\'s success.',
          confidence: 0.96,
          evidence: [
            'Led 5 major architectural initiatives that improved system performance by 60%',
            'Mentored over 20 contributors, with 15 becoming regular contributors',
            'Maintained 96% community reputation through helpful reviews and guidance'
          ],
          recommendations: [
            'Consider for technical steering committee',
            'Feature as keynote speaker at community events',
            'Lead new contributor onboarding program'
          ],
          aiModel: 'gpt-4o',
          generated_at: new Date(),
        },
      },
    }),
    rank: 1,
    showFullInsights: true,
  },
};

// Rising star story
export const RisingStar: Story = {
  args: {
    profile: createMockProfile({
      login: 'rising-star-dev',
      impactLevel: 'rising-star',
      overallScore: 78,
      celebrationPriority: 'high',
      aiInsights: {
        ...createMockProfile().aiInsights,
        impactNarrative: {
          type: 'impact',
          narrative: 'This rising star has shown remarkable growth over the past 8 months, consistently improving their contributions and actively engaging with the community. Their fresh perspective and eagerness to learn have brought innovative solutions to complex problems.',
          confidence: 0.82,
          evidence: [
            'Improved contribution quality by 45% over 8 months',
            'Consistently provides helpful code reviews',
            'Introduced 3 innovative solutions that improved user experience'
          ],
          recommendations: [
            'Assign to high-visibility projects to accelerate growth',
            'Pair with senior contributors for knowledge transfer'
          ],
          aiModel: 'gpt-4o-mini',
          generated_at: new Date(),
        },
        growthPotential: {
          type: 'growth',
          narrative: 'Shows exceptional learning velocity and has demonstrated strong technical growth patterns. High potential for becoming a core contributor within the next year.',
          confidence: 0.87,
          evidence: [
            'Rapid skill development in system architecture',
            'Strong collaboration and communication skills',
            'Proactive in seeking feedback and implementing improvements'
          ],
          recommendations: [
            'Include in technical planning discussions',
            'Provide stretch assignments to accelerate development'
          ],
          aiModel: 'gpt-4o',
          generated_at: new Date(),
        },
      },
    }),
    rank: 3,
    showFullInsights: false,
  },
};

// Solid contributor
export const SolidContributor: Story = {
  args: {
    profile: createMockProfile({
      login: 'reliable-contributor',
      impactLevel: 'solid-contributor',
      overallScore: 68,
      celebrationPriority: 'medium',
      classification: {
        ...createMockProfile().classification,
        login: 'reliable-contributor',
        trustLevel: 'active',
        trustIndicators: {
          monthsActive: 12,
          codeReviewParticipation: 65,
          maintainerNominations: 1,
          securitySensitiveCommits: 4,
          communityReputation: 76,
        },
      },
    }),
    rank: 8,
    showFullInsights: false,
  },
};

// Newcomer
export const Newcomer: Story = {
  args: {
    profile: createMockProfile({
      login: 'new-contributor',
      impactLevel: 'newcomer',
      overallScore: 42,
      celebrationPriority: 'low',
      classification: {
        ...createMockProfile().classification,
        login: 'new-contributor',
        trustLevel: 'new',
        classificationConfidence: 0.65,
        trustIndicators: {
          monthsActive: 2,
          codeReviewParticipation: 25,
          maintainerNominations: 0,
          securitySensitiveCommits: 0,
          communityReputation: 45,
        },
      },
      consistency: {
        ...createMockProfile().consistency,
        login: 'new-contributor',
        consistencyScore: 55,
      },
      aiInsights: {
        impactNarrative: {
          type: 'impact',
          narrative: 'This newcomer shows great promise with thoughtful contributions and willingness to learn. Their recent PRs demonstrate good understanding of project standards and positive engagement with feedback.',
          confidence: 0.72,
          evidence: [
            'All PRs follow project guidelines consistently',
            'Responds positively to code review feedback',
            'Shows initiative in asking clarifying questions'
          ],
          recommendations: [
            'Assign a mentor for guidance',
            'Encourage participation in community discussions'
          ],
          aiModel: 'gpt-4o-mini',
          generated_at: new Date(),
        },
        achievementStory: null,
        growthPotential: null,
      },
    }),
    rank: 15,
    showFullInsights: true,
  },
};

// Without AI insights (fallback)
export const WithoutAI: Story = {
  args: {
    profile: createMockProfile({
      login: 'classic-contributor',
      aiInsights: {
        impactNarrative: null,
        achievementStory: null,
        growthPotential: null,
      },
      aiConfidence: 0,
    }),
    rank: 5,
    showFullInsights: true,
  },
};

// Compact version stories
export const CompactChampion: Story = {
  render: (args) => <ContributorImpactCardCompact {...args} />,
  args: {
    profile: createMockProfile({
      login: 'compact-champion',
      impactLevel: 'champion',
      overallScore: 92,
      celebrationPriority: 'high',
    }),
    rank: 1,
  },
};

export const CompactRisingStar: Story = {
  render: (args) => <ContributorImpactCardCompact {...args} />,
  args: {
    profile: createMockProfile({
      login: 'compact-rising',
      impactLevel: 'rising-star',
      overallScore: 79,
      celebrationPriority: 'high',
    }),
    rank: 2,
  },
};

// Grid layout example
export const GridLayout: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-4xl">
      <ContributorImpactCardCompact 
        profile={createMockProfile({
          login: 'grid-champion',
          impactLevel: 'champion',
          overallScore: 95,
          celebrationPriority: 'high',
        })}
        rank={1}
      />
      <ContributorImpactCardCompact 
        profile={createMockProfile({
          login: 'grid-rising',
          impactLevel: 'rising-star',
          overallScore: 82,
          celebrationPriority: 'high',
        })}
        rank={2}
      />
      <ContributorImpactCardCompact 
        profile={createMockProfile({
          login: 'grid-solid',
          impactLevel: 'solid-contributor',
          overallScore: 69,
          celebrationPriority: 'medium',
        })}
        rank={3}
      />
      <ContributorImpactCardCompact 
        profile={createMockProfile({
          login: 'grid-newcomer',
          impactLevel: 'newcomer',
          overallScore: 48,
          celebrationPriority: 'low',
        })}
        rank={4}
      />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
};

// List layout example  
export const ListView: Story = {
  render: () => (
    <div className="space-y-4 max-w-2xl">
      <ContributorImpactCard 
        profile={createMockProfile({
          login: 'list-champion',
          impactLevel: 'champion',
          overallScore: 95,
          celebrationPriority: 'high',
        })}
        rank={1}
        showFullInsights={false}
      />
      <ContributorImpactCard 
        profile={createMockProfile({
          login: 'list-rising',
          impactLevel: 'rising-star',
          overallScore: 82,
          celebrationPriority: 'high',
        })}
        rank={2}
        showFullInsights={false}
      />
      <ContributorImpactCard 
        profile={createMockProfile({
          login: 'list-solid',
          impactLevel: 'solid-contributor',
          overallScore: 69,
          celebrationPriority: 'medium',
        })}
        rank={3}
        showFullInsights={false}
      />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
};