import type { Meta, StoryObj } from '@storybook/react';
import { QuadrantStats } from './quadrant-stats';
import type { QuadrantData } from '@/lib/types';

// Mock quadrant data sets
const balancedQuadrantData: QuadrantData[] = [
  {
    name: 'Core',
    count: 145,
    percentage: 35.2,
    authors: [
      { id: 1, login: 'alice-dev' },
      { id: 2, login: 'bob-dev' },
      { id: 3, login: 'charlie-dev' },
    ],
  },
  {
    name: 'Peripheral',
    count: 89,
    percentage: 21.6,
    authors: [
      { id: 4, login: 'david-dev' },
      { id: 5, login: 'eve-dev' },
    ],
  },
  {
    name: 'Supplemental',
    count: 112,
    percentage: 27.1,
    authors: [
      { id: 6, login: 'frank-dev' },
      { id: 7, login: 'grace-dev' },
    ],
  },
  {
    name: 'Trivial',
    count: 67,
    percentage: 16.1,
    authors: [{ id: 8, login: 'henry-dev' }],
  },
];

const coreHeavyQuadrantData: QuadrantData[] = [
  {
    name: 'Core',
    count: 320,
    percentage: 68.4,
    authors: [
      { id: 1, login: 'alice-dev' },
      { id: 2, login: 'bob-dev' },
      { id: 3, login: 'charlie-dev' },
      { id: 4, login: 'david-dev' },
    ],
  },
  {
    name: 'Peripheral',
    count: 78,
    percentage: 16.7,
    authors: [{ id: 5, login: 'eve-dev' }],
  },
  {
    name: 'Supplemental',
    count: 45,
    percentage: 9.6,
    authors: [{ id: 6, login: 'frank-dev' }],
  },
  {
    name: 'Trivial',
    count: 25,
    percentage: 5.3,
    authors: [{ id: 7, login: 'grace-dev' }],
  },
];

const documentationHeavyData: QuadrantData[] = [
  {
    name: 'Core',
    count: 23,
    percentage: 8.1,
    authors: [{ id: 1, login: 'alice-dev' }],
  },
  {
    name: 'Peripheral',
    count: 31,
    percentage: 10.9,
    authors: [{ id: 2, login: 'bob-dev' }],
  },
  {
    name: 'Supplemental',
    count: 67,
    percentage: 23.6,
    authors: [
      { id: 3, login: 'charlie-dev' },
      { id: 4, login: 'david-dev' },
    ],
  },
  {
    name: 'Trivial',
    count: 163,
    percentage: 57.4,
    authors: [
      { id: 5, login: 'eve-dev' },
      { id: 6, login: 'frank-dev' },
      { id: 7, login: 'grace-dev' },
      { id: 8, login: 'henry-dev' },
    ],
  },
];

const emptyQuadrantData: QuadrantData[] = [
  {
    name: 'Core',
    count: 0,
    percentage: 0,
    authors: [],
  },
  {
    name: 'Peripheral',
    count: 0,
    percentage: 0,
    authors: [],
  },
  {
    name: 'Supplemental',
    count: 0,
    percentage: 0,
    authors: [],
  },
  {
    name: 'Trivial',
    count: 0,
    percentage: 0,
    authors: [],
  },
];

const singleQuadrantData: QuadrantData[] = [
  {
    name: 'Core',
    count: 1,
    percentage: 100,
    authors: [{ id: 1, login: 'alice-dev' }],
  },
  {
    name: 'Peripheral',
    count: 0,
    percentage: 0,
    authors: [],
  },
  {
    name: 'Supplemental',
    count: 0,
    percentage: 0,
    authors: [],
  },
  {
    name: 'Trivial',
    count: 0,
    percentage: 0,
    authors: [],
  },
];

const meta = {
  title: 'Features/Health/QuadrantStats',
  component: QuadrantStats,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A component that displays repository file statistics across four quadrants: Core, Peripheral, Supplemental, and Trivial. Shows both percentage and absolute counts for each category.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      control: false,
      description: 'Array of quadrant data with name, count, percentage, and color',
    },
  },
} satisfies Meta<typeof QuadrantStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  args: {
    data: balancedQuadrantData,
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Balanced distribution across all four quadrants showing healthy codebase diversity.',
      },
    },
  },
};

export const CoreHeavy: Story = {
  args: {
    data: coreHeavyQuadrantData,
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Core-heavy distribution indicating a codebase with lots of critical files.',
      },
    },
  },
};

export const DocumentationHeavy: Story = {
  args: {
    data: documentationHeavyData,
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Documentation-heavy distribution common in well-documented projects or libraries.',
      },
    },
  },
};

export const EmptyRepository: Story = {
  args: {
    data: emptyQuadrantData,
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Empty repository with no files in any quadrant.',
      },
    },
  },
};

export const SingleFile: Story = {
  args: {
    data: singleQuadrantData,
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Repository with only a single core file.',
      },
    },
  },
};

export const HighVolume: Story = {
  args: {
    data: [
      {
        name: 'Core',
        count: 2847,
        percentage: 42.3,
        authors: [
          { id: 1, login: 'alice-dev' },
          { id: 2, login: 'bob-dev' },
          { id: 3, login: 'charlie-dev' },
          { id: 4, login: 'david-dev' },
          { id: 5, login: 'eve-dev' },
        ],
      },
      {
        name: 'Peripheral',
        count: 1926,
        percentage: 28.6,
        authors: [
          { id: 6, login: 'frank-dev' },
          { id: 7, login: 'grace-dev' },
          { id: 8, login: 'henry-dev' },
        ],
      },
      {
        name: 'Supplemental',
        count: 1204,
        percentage: 17.9,
        authors: [
          { id: 9, login: 'iris-dev' },
          { id: 10, login: 'jack-dev' },
        ],
      },
      {
        name: 'Trivial',
        count: 756,
        percentage: 11.2,
        authors: [{ id: 11, login: 'kate-dev' }],
      },
    ],
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Large repository with thousands of files across quadrants.',
      },
    },
  },
};

export const CompactView: Story = {
  args: {
    data: balancedQuadrantData,
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact view showing responsive layout in smaller container.',
      },
    },
  },
};

export const MobileView: Story = {
  args: {
    data: balancedQuadrantData,
  },
  render: (args) => (
    <div className="w-full p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Quadrant stats on mobile devices with single-column layout.',
      },
    },
  },
};

export const CustomColors: Story = {
  args: {
    data: [
      {
        name: 'Core',
        count: 145,
        percentage: 35.2,
        authors: [
          { id: 1, login: 'alice-dev' },
          { id: 2, login: 'bob-dev' },
          { id: 3, login: 'charlie-dev' },
        ],
      },
      {
        name: 'Peripheral',
        count: 89,
        percentage: 21.6,
        authors: [
          { id: 4, login: 'david-dev' },
          { id: 5, login: 'eve-dev' },
        ],
      },
      {
        name: 'Supplemental',
        count: 112,
        percentage: 27.1,
        authors: [
          { id: 6, login: 'frank-dev' },
          { id: 7, login: 'grace-dev' },
        ],
      },
      {
        name: 'Trivial',
        count: 67,
        percentage: 16.1,
        authors: [{ id: 8, login: 'henry-dev' }],
      },
    ],
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example with custom color scheme for different themes.',
      },
    },
  },
};

export const DecimalPrecision: Story = {
  args: {
    data: [
      {
        name: 'Core',
        count: 7,
        percentage: 33.33,
        authors: [
          { id: 1, login: 'alice-dev' },
          { id: 2, login: 'bob-dev' },
        ],
      },
      {
        name: 'Peripheral',
        count: 5,
        percentage: 23.81,
        authors: [{ id: 3, login: 'charlie-dev' }],
      },
      {
        name: 'Supplemental',
        count: 6,
        percentage: 28.57,
        authors: [
          { id: 4, login: 'david-dev' },
          { id: 5, login: 'eve-dev' },
        ],
      },
      {
        name: 'Trivial',
        count: 3,
        percentage: 14.29,
        authors: [{ id: 6, login: 'frank-dev' }],
      },
    ],
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Small repository showing decimal precision in percentages.',
      },
    },
  },
};
