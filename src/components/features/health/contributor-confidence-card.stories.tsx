import type { Meta, StoryObj } from '@storybook/react';
import { ContributorConfidenceCard } from './contributor-confidence-card';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

// Mock data for different confidence scenarios
const mockConfidenceData = {
  intimidating: {
    score: 9,
    level: 'low' as const,
    description: 'Intimidating - Almost no stargazers and forkers come back later on to make a meaningful contribution'
  },
  approachable: {
    score: 40,
    level: 'medium' as const,
    description: 'Approachable - Some stargazers and forkers come back later on to make a meaningful contribution'
  },
  welcoming: {
    score: 85,
    level: 'high' as const,
    description: 'Welcoming - Many stargazers and forkers come back later on to make a meaningful contribution'
  },
  perfect: {
    score: 100,
    level: 'high' as const,
    description: 'Perfect - All stargazers and forkers come back to contribute'
  },
  none: {
    score: 0,
    level: 'low' as const,
    description: 'No confidence - No stargazers or forkers return to contribute'
  }
};

const meta: Meta<typeof ContributorConfidenceCard> = {
  title: 'Components/Health/ContributorConfidenceCard',
  component: ContributorConfidenceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays the contributor confidence score showing the likelihood of stargazers and forkers returning to make meaningful contributions. Matches the exact design from the project reference.'
      }
    }
  },
  argTypes: {
    confidenceScore: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'The confidence score (0-100)'
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
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Low confidence score (9%) - Project appears intimidating to potential contributors. This matches the first reference design.'
      }
    }
  }
};

export const Approachable: Story = {
  args: {
    confidenceScore: mockConfidenceData.approachable.score,
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Medium confidence score (40%) - Project is approachable for contributors. This matches the second reference design.'
      }
    }
  }
};

export const Welcoming: Story = {
  args: {
    confidenceScore: mockConfidenceData.welcoming.score,
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'High confidence score (85%) - Project is very welcoming to new contributors.'
      }
    }
  }
};

export const Perfect: Story = {
  args: {
    confidenceScore: mockConfidenceData.perfect.score,
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Perfect confidence score (100%) - All stargazers and forkers return to contribute.'
      }
    }
  }
};

export const ZeroConfidence: Story = {
  args: {
    confidenceScore: mockConfidenceData.none.score,
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'No confidence (0%) - No stargazers or forkers return to contribute.'
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
    confidenceScore: 0,
    error: 'Failed to calculate contributor confidence score',
    onLearnMoreClick: () => alert('Learn more clicked!')
  },
  parameters: {
    docs: {
      description: {
        story: 'Error state when confidence score cannot be calculated.'
      }
    }
  }
};

export const WithoutLearnMore: Story = {
  args: {
    confidenceScore: 65
  },
  parameters: {
    docs: {
      description: {
        story: 'Card without the "Learn More" link.'
      }
    }
  }
};

export const Interactive: Story = {
  args: { confidenceScore: 40 },
  render: () => {
    const InteractiveDemo = () => {
      const [confidence, setConfidence] = useState(40);
      
      return (
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={confidence}
            onLearnMoreClick={() => alert('Learn more clicked!')}
          />
          
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(Math.max(0, confidence - 10))}
              disabled={confidence === 0}
            >
              -10%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(Math.min(100, confidence + 10))}
              disabled={confidence === 100}
            >
              +10%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(9)}
            >
              Intimidating
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(40)}
            >
              Approachable
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setConfidence(85)}
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
        story: 'Interactive demo allowing you to change the confidence score and see different states.'
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
            if (prev >= 100) {
              return 0;
            }
            return prev + 2;
          });
        }, 100);
        
        return () => clearInterval(timer);
      }, []);
      
      return (
        <ContributorConfidenceCard 
          confidenceScore={progress}
          onLearnMoreClick={() => alert('Learn more clicked!')}
        />
      );
    };
    
    return <AnimatedDemo />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Animated progress showing smooth transitions between confidence levels.'
      }
    }
  }
};

export const ComparisonGrid: Story = {
  args: { confidenceScore: 50 },
  render: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-fit">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Low Confidence</h3>
        <ContributorConfidenceCard 
          confidenceScore={9}
          onLearnMoreClick={() => alert('Intimidating project')}
        />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Medium Confidence</h3>
        <ContributorConfidenceCard 
          confidenceScore={40}
          onLearnMoreClick={() => alert('Approachable project')}
        />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">High Confidence</h3>
        <ContributorConfidenceCard 
          confidenceScore={85}
          onLearnMoreClick={() => alert('Welcoming project')}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison showing different confidence levels side by side.'
      }
    }
  }
};

export const EdgeCases: Story = {
  args: { confidenceScore: 50 },
  render: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-fit">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">Boundary Cases</h3>
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={30}
            onLearnMoreClick={() => alert('30% - boundary between low and medium')}
          />
          <ContributorConfidenceCard 
            confidenceScore={70}
            onLearnMoreClick={() => alert('70% - boundary between medium and high')}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-center">States</h3>
        <div className="space-y-4">
          <ContributorConfidenceCard 
            confidenceScore={0}
            loading={true}
          />
          <ContributorConfidenceCard 
            confidenceScore={0}
            error="Network error"
            onLearnMoreClick={() => alert('Error state')}
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Edge cases including boundary values and error states.'
      }
    }
  }
};

export const ResponsiveDemo: Story = {
  args: { confidenceScore: 60 },
  render: () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Default Size (404px)</h3>
      <ContributorConfidenceCard 
        confidenceScore={60}
        onLearnMoreClick={() => alert('Default size')}
      />
      
      <h3 className="text-sm font-medium">With Custom Class</h3>
      <ContributorConfidenceCard 
        confidenceScore={60}
        className="w-full max-w-sm"
        onLearnMoreClick={() => alert('Custom size')}
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