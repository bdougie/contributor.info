import type { Meta, StoryObj } from '@storybook/react';
import { CircularProgress } from './circular-progress';
import { useState, useEffect } from 'react';
import { Button } from './button';

const meta = {
  title: 'UI/Feedback/CircularProgress',
  component: CircularProgress,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A circular progress indicator with customizable appearance and animations.',
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
      description: 'The size of the circular progress',
    },
    strokeWidth: {
      control: 'number',
      description: 'The width of the progress stroke',
    },
  },
} satisfies Meta<typeof CircularProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 65,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">65</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const Low: Story = {
  args: {
    value: 15,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">15</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const Medium: Story = {
  args: {
    value: 50,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">50</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const High: Story = {
  args: {
    value: 85,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">85</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">100</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    children: (
      <div className="text-center">
        <span className="font-bold text-2xl">0</span>
        <span className="font-bold text-xs">%</span>
      </div>
    ),
  },
};

export const DifferentSizes: Story = {
  args: { value: 75 },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <p className="text-sm mb-2">Small (60px)</p>
        <CircularProgress value={75} size={60} strokeWidth={3}>
          <div className="text-center">
            <span className="font-bold text-lg">75</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Default (98px)</p>
        <CircularProgress value={75}>
          <div className="text-center">
            <span className="font-bold text-2xl">75</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Large (120px)</p>
        <CircularProgress value={75} size={120} strokeWidth={6}>
          <div className="text-center">
            <span className="font-bold text-3xl">75</span>
            <span className="font-bold text-sm">%</span>
          </div>
        </CircularProgress>
      </div>
    </div>
  ),
};

export const CustomColors: Story = {
  args: { value: 50 },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <p className="text-sm mb-2">Custom Red</p>
        <CircularProgress 
          value={25} 
          progressClassName="text-red-600"
        >
          <div className="text-center">
            <span className="font-bold text-2xl">25</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Custom Blue</p>
        <CircularProgress 
          value={50} 
          progressClassName="text-blue-600"
        >
          <div className="text-center">
            <span className="font-bold text-2xl">50</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Custom Purple</p>
        <CircularProgress 
          value={75} 
          progressClassName="text-purple-600"
        >
          <div className="text-center">
            <span className="font-bold text-2xl">75</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
    </div>
  ),
};

export const WithoutCenterContent: Story = {
  args: {
    value: 60,
  },
};

export const DifferentStrokeWidths: Story = {
  args: { value: 60 },
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <p className="text-sm mb-2">Thin (2px)</p>
        <CircularProgress value={60} strokeWidth={2}>
          <div className="text-center">
            <span className="font-bold text-2xl">60</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Default (4px)</p>
        <CircularProgress value={60}>
          <div className="text-center">
            <span className="font-bold text-2xl">60</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2">Thick (8px)</p>
        <CircularProgress value={60} strokeWidth={8}>
          <div className="text-center">
            <span className="font-bold text-2xl">60</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
    </div>
  ),
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
            return prev + 1;
          });
        }, 50);
        
        return () => clearInterval(timer);
      }, []);
      
      return (
        <div className="text-center">
          <p className="text-sm mb-4">Animated Progress</p>
          <CircularProgress value={progress}>
            <div className="text-center">
              <span className="font-bold text-2xl">{progress}</span>
              <span className="font-bold text-xs">%</span>
            </div>
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
      const [progress, setProgress] = useState(33);
      
      return (
        <div className="text-center space-y-4">
          <p className="text-sm">Interactive Progress</p>
          <CircularProgress value={progress}>
            <div className="text-center">
              <span className="font-bold text-2xl">{progress}</span>
              <span className="font-bold text-xs">%</span>
            </div>
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setProgress(0)}
            >
              Reset
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
        <p className="text-sm mb-2 text-red-600">Intimidating</p>
        <CircularProgress value={9}>
          <div className="text-center">
            <span className="font-bold text-2xl">9</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2 text-yellow-600">Approachable</p>
        <CircularProgress value={40}>
          <div className="text-center">
            <span className="font-bold text-2xl">40</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
      
      <div className="text-center">
        <p className="text-sm mb-2 text-green-600">Welcoming</p>
        <CircularProgress value={85}>
          <div className="text-center">
            <span className="font-bold text-2xl">85</span>
            <span className="font-bold text-xs">%</span>
          </div>
        </CircularProgress>
      </div>
    </div>
  ),
};