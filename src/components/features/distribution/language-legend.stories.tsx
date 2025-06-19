import type { Meta, StoryObj } from "@storybook/react";
import { LanguageLegend } from "./language-legend";
import type { LanguageStat } from "@/lib/language-stats";

const meta = {
  title: "Components/Distribution/LanguageLegend",
  component: LanguageLegend,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A legend component that displays programming language statistics with color-coded indicators and percentages.",
      },
    },
  },
  tags: ["autodocs"],
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
const basicLanguages: LanguageStat[] = [
  { name: "TypeScript", percentage: 45, color: "#3178c6" },
  { name: "JavaScript", percentage: 30, color: "#f7df1e" },
  { name: "CSS", percentage: 15, color: "#1572b6" },
  { name: "HTML", percentage: 10, color: "#e34c26" },
];

const manyLanguages: LanguageStat[] = [
  { name: "TypeScript", percentage: 25, color: "#3178c6" },
  { name: "JavaScript", percentage: 20, color: "#f7df1e" },
  { name: "Python", percentage: 15, color: "#3776ab" },
  { name: "Go", percentage: 10, color: "#00add8" },
  { name: "Rust", percentage: 8, color: "#dea584" },
  { name: "Java", percentage: 7, color: "#007396" },
  { name: "CSS", percentage: 5, color: "#1572b6" },
  { name: "HTML", percentage: 4, color: "#e34c26" },
  { name: "Ruby", percentage: 3, color: "#cc342d" },
  { name: "Other", percentage: 3, color: "#959da5" },
];

const singleLanguage: LanguageStat[] = [
  { name: "TypeScript", percentage: 100, color: "#3178c6" },
];

const withOtherCategory: LanguageStat[] = [
  { name: "TypeScript", percentage: 60, color: "#3178c6" },
  { name: "JavaScript", percentage: 25, color: "#f7df1e" },
  { name: "Other", percentage: 15, color: "#959da5" },
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
        story: "Shows the legend with many programming languages, demonstrating how it handles overflow.",
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
        story: "Shows the legend when the codebase uses only one programming language.",
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
        story: "Shows the legend with no language data.",
      },
    },
  },
};

export const FrontendStack: Story = {
  args: {
    languages: [
      { name: "TypeScript", percentage: 40, color: "#3178c6" },
      { name: "React", percentage: 25, color: "#61dafb" },
      { name: "CSS", percentage: 20, color: "#1572b6" },
      { name: "HTML", percentage: 10, color: "#e34c26" },
      { name: "GraphQL", percentage: 5, color: "#e10098" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a typical frontend project language distribution.",
      },
    },
  },
};

export const BackendStack: Story = {
  args: {
    languages: [
      { name: "Go", percentage: 35, color: "#00add8" },
      { name: "Python", percentage: 30, color: "#3776ab" },
      { name: "SQL", percentage: 20, color: "#336791" },
      { name: "Shell", percentage: 10, color: "#89e051" },
      { name: "Dockerfile", percentage: 5, color: "#2496ed" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a typical backend project language distribution.",
      },
    },
  },
};

export const MobileStack: Story = {
  args: {
    languages: [
      { name: "Swift", percentage: 45, color: "#fa7343" },
      { name: "Kotlin", percentage: 35, color: "#7f52ff" },
      { name: "Objective-C", percentage: 10, color: "#438eff" },
      { name: "Java", percentage: 10, color: "#007396" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a mobile app project language distribution.",
      },
    },
  },
};

export const LowPercentages: Story = {
  args: {
    languages: [
      { name: "TypeScript", percentage: 2.5, color: "#3178c6" },
      { name: "JavaScript", percentage: 1.8, color: "#f7df1e" },
      { name: "CSS", percentage: 0.7, color: "#1572b6" },
      { name: "HTML", percentage: 0.3, color: "#e34c26" },
      { name: "Other", percentage: 94.7, color: "#959da5" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the component handles very small percentage values.",
      },
    },
  },
};

export const CustomColors: Story = {
  args: {
    languages: [
      { name: "Custom Lang 1", percentage: 30, color: "#ff6b6b" },
      { name: "Custom Lang 2", percentage: 25, color: "#4ecdc4" },
      { name: "Custom Lang 3", percentage: 25, color: "#45b7d1" },
      { name: "Custom Lang 4", percentage: 20, color: "#96ceb4" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the legend with custom language colors.",
      },
    },
  },
};

export const Wrapped: Story = {
  args: {
    languages: Array.from({ length: 15 }, (_, i) => ({
      name: `Language ${i + 1}`,
      percentage: 100 / 15,
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
        story: "Shows how the legend wraps when constrained to a narrow container.",
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
        story: "Shows the legend in dark mode.",
      },
    },
  },
};