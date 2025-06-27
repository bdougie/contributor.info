import type { Meta, StoryObj } from '@storybook/react';
import { ContributorConfidenceCard } from './contributor-confidence-card';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Mock breakdown data for testing
const mockBreakdown = {
  starForkConfidence: 15.5,
  engagementConfidence: 12.3,
  retentionConfidence: 8.7,
  qualityConfidence: 23.1,
  totalStargazers: 1250,
  totalForkers: 89,
  contributorCount: 45,
  conversionRate: 3.6
};

// Mock data for different confidence scenarios
const mockConfidenceData = {
  intimidating: {
    score: 3,
    level: 'low' as const,
    description: 'Your project can be Intimidating - Almost no stargazers and forkers come back later on to make a meaningful contribution'
  },
  challenging: {
    score: 12,
    level: 'medium' as const,
    description: 'Your project is challenging - Few stargazers and forkers come back later on to make a meaningful contribution'
  },
  approachable: {
    score: 25,
    level: 'medium' as const,
    description: 'Your project is approachable! - Some stargazers and forkers come back later on to make a meaningful contribution'
  },
  welcoming: {
    score: 42,
    level: 'high' as const,
    description: 'Your project is welcoming! - Many stargazers and forkers come back later on to make a meaningful contribution'
  },
  perfect: {
    score: 50,
    level: 'high' as const,
    description: 'Your project is welcoming! - Maximum confidence achieved'
  },
  none: {
    score: 0,
    level: 'low' as const,
    description: 'Your project can be Intimidating - No confidence data available'
  }
};

const meta: Meta<typeof ContributorConfidenceCard> = {
  title: 'Components/Health/ContributorConfidenceCard',
  component: ContributorConfidenceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays the contributor confidence score showing the likelihood of stargazers and forkers returning to make meaningful contributions. Features a semi-circle progress indicator that fills from left to right, with color-coded ranges and breakdown tooltips.'
      }
    }
  },
  argTypes: {
    confidenceScore: {
      control: { type: 'range', min: 0, max: 50, step: 0.5 },
      description: 'The confidence score (0-50, scaled to 0-100% for display)'
    },
    loading: {
      control: 'boolean',
      description: 'Loading state'
    },
    error: {
      control: 'text',
      description: 'Error message'
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    },
    owner: {
      control: 'text',
      description: 'Repository owner'
    },
    repo: {
      control: 'text',
      description: 'Repository name'
    },
    breakdown: {
      control: 'object',
      description: 'Confidence breakdown data for tooltip'
    }
  },
  decorators: [
    (Story) => (
      <div className="w-fit">
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof ContributorConfidenceCard>;

export const Intimidating: Story = {
  args: {
    confidenceScore: mockConfidenceData.intimidating.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'intimidating-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Low confidence score (3%) - Project appears intimidating to potential contributors. Red progress indicator.'
      }
    }
  }
};

export const Challenging: Story = {
  args: {
    confidenceScore: mockConfidenceData.challenging.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'challenging-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Low-medium confidence score (12%) - Project is challenging for contributors. Orange progress indicator.'
      }
    }
  }
};

export const Approachable: Story = {
  args: {
    confidenceScore: mockConfidenceData.approachable.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'approachable-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Medium confidence score (25%) - Project is approachable for contributors. Blue progress indicator.'
      }
    }
  }
};

export const Welcoming: Story = {
  args: {
    confidenceScore: mockConfidenceData.welcoming.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'welcoming-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'High confidence score (42%) - Project is very welcoming to new contributors. Green progress indicator.'
      }
    }
  }
};

export const Perfect: Story = {
  args: {
    confidenceScore: mockConfidenceData.perfect.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'perfect-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Perfect confidence score (50%) - Maximum confidence achieved. Full green semicircle.'
      }
    }
  }
};

export const ZeroConfidence: Story = {
  args: {
    confidenceScore: mockConfidenceData.none.score,
    breakdown: mockBreakdown,
    owner: 'example',
    repo: 'zero-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'No confidence (0%) - No progress shown, only background semicircle.'
      }
    }
  }
};

export const LoadingState: Story = {
  args: {
    confidenceScore: 0,
    loading: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state with skeleton animation while confidence score is being calculated.'
      }
    }
  }
};

export const ErrorState: Story = {
  args: {
    confidenceScore: null,
    error: 'Failed to calculate contributor confidence score',
    owner: 'example',
    repo: 'error-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Error state when confidence score cannot be calculated.'
      }
    }
  }
};

export const WithoutBreakdown: Story = {
  args: {
    confidenceScore: 32,
    owner: 'example',
    repo: 'simple-project'
  },
  parameters: {
    docs: {
      description: {
        story: 'Card without breakdown data tooltip.'
      }
    }
  }
};

export const Interactive: Story = {
  args: { confidenceScore: 20 },
  render: () => {
    const InteractiveDemo = () => {
      const [confidence, setConfidence] = useState(20);
      
      return (
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={confidence}
            breakdown={mockBreakdown}
            owner="example"
            repo="interactive-demo"
          />
          
          <div className="flex gap-2 justify-center flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(Math.max(0, confidence - 2))}
              disabled={confidence === 0}
            >
              -2%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(Math.min(50, confidence + 2))}
              disabled={confidence === 50}
            >
              +2%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(3)}
            >
              Intimidating
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(12)}
            >
              Challenging
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(25)}
            >
              Approachable
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(42)}
            >
              Welcoming
            </Button>
          </div>
        </div>
      );
    };
    
    return <InteractiveDemo />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo allowing you to change the confidence score and see different states and colors.'
      }
    }
  }
};

export const AnimatedProgress: Story = {
  args: { confidenceScore: 0 },
  render: () => {
    const AnimatedDemo = () => {
      const [progress, setProgress] = useState(0);
      
      useEffect(() => {
        const timer = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 50) {
              return 0;
            }
            return prev + 0.5;
          });
        }, 100);
        
        return () => clearInterval(timer);
      }, []);
      
      return (
        <ContributorConfidenceCard 
          confidenceScore={progress}
          breakdown={mockBreakdown}
          owner="example"
          repo="animated-demo"
        />
      );
    };
    
    return <AnimatedDemo />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Animated progress showing smooth transitions between confidence levels and color changes.'
      }
    }
  }
};

export const ComparisonGrid: Story = {
  args: { confidenceScore: 25 },
  render: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 w-fit">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Intimidating (Red)</h3>
        <ContributorConfidenceCard 
          confidenceScore={3}
          breakdown={mockBreakdown}
          owner="example"
          repo="intimidating"
        />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Challenging (Orange)</h3>
        <ContributorConfidenceCard 
          confidenceScore={12}
          breakdown={mockBreakdown}
          owner="example"
          repo="challenging"
        />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Approachable (Blue)</h3>
        <ContributorConfidenceCard 
          confidenceScore={25}
          breakdown={mockBreakdown}
          owner="example"
          repo="approachable"
        />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Welcoming (Green)</h3>
        <ContributorConfidenceCard 
          confidenceScore={42}
          breakdown={mockBreakdown}
          owner="example"
          repo="welcoming"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison showing all confidence levels and color coding side by side.'
      }
    }
  }
};

export const EdgeCases: Story = {
  args: { confidenceScore: 25 },
  render: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-fit">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Boundary Cases</h3>
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={5}
            breakdown={mockBreakdown}
            owner="example"
            repo="boundary-low"
          />
          <ContributorConfidenceCard 
            confidenceScore={15}
            breakdown={mockBreakdown}
            owner="example"
            repo="boundary-medium"
          />
          <ContributorConfidenceCard 
            confidenceScore={35}
            breakdown={mockBreakdown}
            owner="example"
            repo="boundary-high"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">States</h3>
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={null}
            loading={true}
            owner="example"
            repo="loading-state"
          />
          <ContributorConfidenceCard 
            confidenceScore={null}
            error="Network error"
            owner="example"
            repo="error-state"
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Edge cases including color boundary values and error states.'
      }
    }
  }
};

export const ResponsiveDemo: Story = {
  args: { confidenceScore: 30 },
  render: () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Default Size</h3>
      <ContributorConfidenceCard 
        confidenceScore={30}
        breakdown={mockBreakdown}
        owner="example"
        repo="default-size"
      />
      
      <h3 className="text-sm font-medium">With Custom Class</h3>
      <ContributorConfidenceCard 
        confidenceScore={30}
        breakdown={mockBreakdown}
        className="w-full max-w-sm"
        owner="example"
        repo="custom-size"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Responsive behavior with different container sizes.'
      }
    }
  }
};

export const SemicircleShowcase: Story = {
  args: { confidenceScore: 25 },
  render: () => (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4">Semi-circle Progress Visualization</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Progress fills from left to right with color-coded ranges:
          <br />
          <span className="text-red-600">Red (0-5%)</span> • 
          <span className="text-orange-600">Orange (6-15%)</span> • 
          <span className="text-blue-600">Blue (16-35%)</span> • 
          <span className="text-green-600">Green (36-50%)</span>
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[0, 2, 8, 18, 30, 45].map((score) => (
          <div key={score} className="space-y-2">
            <h4 className="text-xs font-medium text-center">{score}% Score</h4>
            <ContributorConfidenceCard 
              confidenceScore={score}
              breakdown={mockBreakdown}
              owner="example"
              repo={`score-${score}`}
            />
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of the semi-circle progress indicator across different score ranges, demonstrating the left-to-right fill pattern and color transitions.'
      }
    }
  }
};