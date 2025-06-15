import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress';
import { useState, useEffect } from 'react';
import { Button } from './button';

const meta = {
  title: 'UI/Feedback/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays an indicator showing the completion progress of a task.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'The progress value (0-100)',
    },
    max: {
      control: 'number',
      description: 'The maximum value',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 33,
  },
};

export const HalfProgress: Story = {
  args: {
    value: 50,
  },
};

export const NearComplete: Story = {
  args: {
    value: 85,
  },
};

export const Complete: Story = {
  args: {
    value: 100,
  },
};

export const Empty: Story = {
  args: {
    value: 0,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Installing...</span>
        <span>45%</span>
      </div>
      <Progress value={45} />
    </div>
  ),
};

export const FileUpload: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>document.pdf</span>
          <span>2.4 MB / 5.1 MB</span>
        </div>
        <Progress value={47} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>image.jpg</span>
          <span>1.8 MB / 1.8 MB</span>
        </div>
        <Progress value={100} className="[&>div]:bg-green-500" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>video.mp4</span>
          <span>0 MB / 24.5 MB</span>
        </div>
        <Progress value={0} />
      </div>
    </div>
  ),
};

export const DifferentSizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm">Small</p>
        <Progress value={60} className="h-1" />
      </div>
      <div className="space-y-1">
        <p className="text-sm">Default</p>
        <Progress value={60} />
      </div>
      <div className="space-y-1">
        <p className="text-sm">Large</p>
        <Progress value={60} className="h-3" />
      </div>
      <div className="space-y-1">
        <p className="text-sm">Extra Large</p>
        <Progress value={60} className="h-4" />
      </div>
    </div>
  ),
};

export const CustomColors: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm">Success (Green)</p>
        <Progress value={75} className="[&>div]:bg-green-500" />
      </div>
      <div className="space-y-2">
        <p className="text-sm">Warning (Yellow)</p>
        <Progress value={45} className="[&>div]:bg-yellow-500" />
      </div>
      <div className="space-y-2">
        <p className="text-sm">Error (Red)</p>
        <Progress value={25} className="[&>div]:bg-red-500" />
      </div>
      <div className="space-y-2">
        <p className="text-sm">Info (Blue)</p>
        <Progress value={60} className="[&>div]:bg-blue-500" />
      </div>
    </div>
  ),
};

export const SkillLevels: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>JavaScript</span>
          <span>Expert</span>
        </div>
        <Progress value={90} className="[&>div]:bg-blue-500" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>React</span>
          <span>Advanced</span>
        </div>
        <Progress value={80} className="[&>div]:bg-green-500" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>TypeScript</span>
          <span>Intermediate</span>
        </div>
        <Progress value={65} className="[&>div]:bg-yellow-500" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Python</span>
          <span>Beginner</span>
        </div>
        <Progress value={30} className="[&>div]:bg-orange-500" />
      </div>
    </div>
  ),
};

export const Animated: Story = {
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
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Loading...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      );
    };
    
    return <AnimatedProgress />;
  },
};

export const TaskProgress: Story = {
  render: () => {
    const TaskProgressDemo = () => {
      const [tasks] = useState([
        { id: 1, name: 'Setup project', completed: true, progress: 100 },
        { id: 2, name: 'Install dependencies', completed: true, progress: 100 },
        { id: 3, name: 'Configure database', completed: false, progress: 75 },
        { id: 4, name: 'Write tests', completed: false, progress: 45 },
        { id: 5, name: 'Deploy to production', completed: false, progress: 0 },
      ]);
      
      const overallProgress = tasks.reduce((acc, task) => acc + task.progress, 0) / tasks.length;
      
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Overall Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>
          
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                    {task.name}
                  </span>
                  <span>{task.progress}%</span>
                </div>
                <Progress 
                  value={task.progress} 
                  className={`h-1 ${task.completed ? '[&>div]:bg-green-500' : ''}`}
                />
              </div>
            ))}
          </div>
        </div>
      );
    };
    
    return <TaskProgressDemo />;
  },
};

export const Interactive: Story = {
  render: () => {
    const InteractiveProgress = () => {
      const [progress, setProgress] = useState(33);
      
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
          
          <div className="flex gap-2">
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