import type { Meta, StoryObj } from '@storybook/react';
import { LanguageLegend } from './language-legend';
import type { LanguageStats } from '@/lib/types';

const meta = {
  title: 'Components/Distribution/LanguageLegend',
  component: LanguageLegend,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A legend component that displays programming language statistics with color-coded indicators and percentages.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LanguageLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock language data
const basicLanguages: LanguageStats[] = [
  { name: 'TypeScript', count: 45, color: '#3178c6' },
  { name: 'JavaScript', count: 30, color: '#f7df1e' },
  { name: 'CSS', count: 15, color: '#1572b6' },
  { name: 'HTML', count: 10, color: '#e34c26' },
];

const manyLanguages: LanguageStats[] = [
  { name: 'TypeScript', count: 25, color: '#3178c6' },
  { name: 'JavaScript', count: 20, color: '#f7df1e' },
  { name: 'Python', count: 15, color: '#3776ab' },
  { name: 'Go', count: 10, color: '#00add8' },
  { name: 'Rust', count: 8, color: '#dea584' },
  { name: 'Java', count: 7, color: '#007396' },
  { name: 'CSS', count: 5, color: '#1572b6' },
  { name: 'HTML', count: 4, color: '#e34c26' },
  { name: 'Ruby', count: 3, color: '#cc342d' },
  { name: 'Other', count: 3, color: '#959da5' },
];

const singleLanguage: LanguageStats[] = [{ name: 'TypeScript', count: 100, color: '#3178c6' }];

const withOtherCategory: LanguageStats[] = [
  { name: 'TypeScript', count: 60, color: '#3178c6' },
  { name: 'JavaScript', count: 25, color: '#f7df1e' },
  { name: 'Other', count: 15, color: '#959da5' },
];

export const Default: Story = {
  args: {
    languages: basicLanguages,
  },
};

export const ManyLanguages: Story = {
  args: {
    languages: manyLanguages,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the legend with many programming languages, demonstrating how it handles overflow.',
      },
    },
  },
};

export const SingleLanguage: Story = {
  args: {
    languages: singleLanguage,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the legend when the codebase uses only one programming language.',
      },
    },
  },
};

export const WithOtherCategory: Story = {
  args: {
    languages: withOtherCategory,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the legend with an 'Other' category for less common languages.",
      },
    },
  },
};

export const EmptyState: Story = {
  args: {
    languages: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the legend with no language data.',
      },
    },
  },
};

export const FrontendStack: Story = {
  args: {
    languages: [
      { name: 'TypeScript', count: 40, color: '#3178c6' },
      { name: 'React', count: 25, color: '#61dafb' },
      { name: 'CSS', count: 20, color: '#1572b6' },
      { name: 'HTML', count: 10, color: '#e34c26' },
      { name: 'GraphQL', count: 5, color: '#e10098' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a typical frontend project language distribution.',
      },
    },
  },
};

export const BackendStack: Story = {
  args: {
    languages: [
      { name: 'Go', count: 35, color: '#00add8' },
      { name: 'Python', count: 30, color: '#3776ab' },
      { name: 'SQL', count: 20, color: '#336791' },
      { name: 'Shell', count: 10, color: '#89e051' },
      { name: 'Dockerfile', count: 5, color: '#2496ed' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a typical backend project language distribution.',
      },
    },
  },
};

export const MobileStack: Story = {
  args: {
    languages: [
      { name: 'Swift', count: 45, color: '#fa7343' },
      { name: 'Kotlin', count: 35, color: '#7f52ff' },
      { name: 'Objective-C', count: 10, color: '#438eff' },
      { name: 'Java', count: 10, color: '#007396' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a mobile app project language distribution.',
      },
    },
  },
};

export const LowPercentages: Story = {
  args: {
    languages: [
      { name: 'TypeScript', count: 3, color: '#3178c6' },
      { name: 'JavaScript', count: 2, color: '#f7df1e' },
      { name: 'CSS', count: 1, color: '#1572b6' },
      { name: 'HTML', count: 1, color: '#e34c26' },
      { name: 'Other', count: 95, color: '#959da5' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how the component handles very small percentage values.',
      },
    },
  },
};

export const CustomColors: Story = {
  args: {
    languages: [
      { name: 'Custom Lang 1', count: 30, color: '#ff6b6b' },
      { name: 'Custom Lang 2', count: 25, color: '#4ecdc4' },
      { name: 'Custom Lang 3', count: 25, color: '#45b7d1' },
      { name: 'Custom Lang 4', count: 20, color: '#96ceb4' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the legend with custom language colors.',
      },
    },
  },
};

export const Wrapped: Story = {
  args: {
    languages: Array.from({ length: 15 }, (_, i) => ({
      name: `Language ${i + 1}`,
      count: Math.floor(100 / 15),
      color: `hsl(${(i * 360) / 15}, 70%, 50%)`,
    })),
  },
  render: (args) => (
    <div className="w-96">
      <LanguageLegend {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows how the legend wraps when constrained to a narrow container.',
      },
    },
  },
};

export const DarkMode: Story = {
  args: {
    languages: basicLanguages,
  },
  decorators: [
    (Story) => (
      <div className="dark bg-slate-900 p-8 rounded-lg">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Shows the legend in dark mode.',
      },
    },
  },
};
