import type { Meta, StoryObj } from '@storybook/react';
import { CircularProgress } from './circular-progress';
import { useState, useEffect } from 'react';
import { Button } from './button';
import { getValueCategoryColor } from '@/lib/utils/threshold-styling';

const meta = {
  title: 'UI/Feedback/SemicircleProgress',
  component: CircularProgress,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A semicircle progress indicator that grows from left to right, matching the exact design from project 8 reference.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'The progress value (0-100)',
    },
    size: {
      control: 'number',
      description: 'The size of the semicircle progress',
    },
  },
} satisfies Meta<typeof CircularProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Intimidating: Story = {
  args: {
    value: 9,
    children: (
      <>
        <span className="font-bold tracking-[-0.05px]">9</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Low confidence (9%) - Red progress indicator showing intimidating project.',
      },
    },
  },
};

export const Approachable: Story = {
  args: {
    value: 40,
    children: (
      <>
        <span className="font-bold tracking-[-0.05px]">40</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Medium confidence (40%) - Orange progress indicator showing approachable project.',
      },
    },
  },
};

export const Welcoming: Story = {
  args: {
    value: 85,
    children: (
      <>
        <span className="font-bold tracking-[-0.05px]">85</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'High confidence (85%) - Green progress indicator showing welcoming project.',
      },
    },
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    children: (
      <>
        <span className="font-bold tracking-[-0.05px]">100</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </>
    ),
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    children: (
      <>
        <span className="font-bold tracking-[-0.05px]">0</span>
        <span className="font-bold text-xs tracking-[-0.01px]">%</span>
      </>
    ),
  },
};

export const Animated: Story = {
  args: { value: 0 },
  render: () => {
    const AnimatedProgress = () => {
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
        <div className="text-center">
          <p className="text-sm mb-4">Animated Semicircle Progress</p>
          <CircularProgress value={progress}>
            <span className="font-bold tracking-[-0.05px]">{progress}</span>
            <span className="font-bold text-xs tracking-[-0.01px]">%</span>
          </CircularProgress>
        </div>
      );
    };

    return <AnimatedProgress />;
  },
};

export const Interactive: Story = {
  args: { value: 33 },
  render: () => {
    const InteractiveProgress = () => {
      const [progress, setProgress] = useState(40);

      return (
        <div className="text-center space-y-4">
          <p className="text-sm">Interactive Semicircle Progress</p>
          <CircularProgress value={progress}>
            <span className="font-bold tracking-[-0.05px]">{progress}</span>
            <span className="font-bold text-xs tracking-[-0.01px]">%</span>
          </CircularProgress>

          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProgress(Math.max(0, progress - 10))}
              disabled={progress === 0}
            >
              -10%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProgress(Math.min(100, progress + 10))}
              disabled={progress === 100}
            >
              +10%
            </Button>
            <Button variant="outline" size="sm" onClick={() => setProgress(9)}>
              Intimidating
            </Button>
            <Button variant="outline" size="sm" onClick={() => setProgress(40)}>
              Approachable
            </Button>
            <Button variant="outline" size="sm" onClick={() => setProgress(85)}>
              Welcoming
            </Button>
          </div>
        </div>
      );
    };

    return <InteractiveProgress />;
  },
};

export const ConfidenceLevels: Story = {
  args: { value: 50 },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <p className="text-sm mb-2 text-red-600">Intimidating (0-30%)</p>
        <CircularProgress value={9}>
          <span className="font-bold tracking-[-0.05px]">9</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>

      <div className="text-center">
        <p className="text-sm mb-2 text-orange-600">Challenging (31-50%)</p>
        <CircularProgress value={40}>
          <span className="font-bold tracking-[-0.05px]">40</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>

      <div className="text-center">
        <p className="text-sm mb-2 text-blue-600">Approachable (51-70%)</p>
        <CircularProgress value={60}>
          <span className="font-bold tracking-[-0.05px]">60</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>

      <div className="text-center">
        <p className="text-sm mb-2 text-green-600">Welcoming (71-100%)</p>
        <CircularProgress value={85}>
          <span className="font-bold tracking-[-0.05px]">85</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>
    </div>
  ),
};

export const BoundaryValues: Story = {
  args: { value: 50 },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <p className="text-sm mb-2">30% (Red/Orange boundary)</p>
        <CircularProgress value={30}>
          <span className="font-bold tracking-[-0.05px]">30</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>

      <div className="text-center">
        <p className="text-sm mb-2">50% (Orange/Blue boundary)</p>
        <CircularProgress value={50}>
          <span className="font-bold tracking-[-0.05px]">50</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>

      <div className="text-center">
        <p className="text-sm mb-2">70% (Blue/Green boundary)</p>
        <CircularProgress value={70}>
          <span className="font-bold tracking-[-0.05px]">70</span>
          <span className="font-bold text-xs tracking-[-0.01px]">%</span>
        </CircularProgress>
      </div>
    </div>
  ),
};

export const WithoutContent: Story = {
  args: {
    value: 60,
  },
  parameters: {
    docs: {
      description: {
        story: 'Semicircle progress without center content.',
      },
    },
  },
};

export const AllPercentages: Story = {
  args: { value: 50 },
  render: () => (
    <div className="grid grid-cols-5 gap-8">
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
        <div key={value} className="flex flex-col items-center">
          <CircularProgress value={value}>
            <span className="font-bold tracking-[-0.05px]">{value}</span>
            <span className="font-bold text-xs tracking-[-0.01px]">%</span>
          </CircularProgress>
          <span className="mt-2 text-sm text-muted-foreground">
{getValueCategoryColor(value)}
          </span>
        </div>
      ))}
    </div>
  ),
};
