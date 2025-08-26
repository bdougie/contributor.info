import type { Meta, StoryObj } from "@storybook/react";
import { DistributionCharts } from "./distribution-charts";
import { useState } from "react";
import type { QuadrantData } from "@/hooks/use-distribution";
import type { PullRequest } from "@/lib/types";

// Helper function to create mock pull requests
const createMockPR = (
  id: number,
  login: string,
  additions: number,
  deletions: number,
  language: string,
  title: string
): PullRequest => ({
  id,
  number: id,
  title,
  state: "closed",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  merged_at: new Date().toISOString(),
  additions,
  deletions,
  repository_owner: "test-org",
  repository_name: "test-repo",
  user: {
    id,
    login,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    type: "User",
  },
  html_url: `https://github.com/test-org/test-repo/pull/${id}`,
  commits: [
    {
      language,
      additions,
      deletions,
    },
  ],
});

// Mock data for different distribution patterns
const balancedData: QuadrantData[] = [
  {
    id: "refinement",
    label: "Refinement",
    value: 25,
    color: "#4ade80",
    percentage: 25,
    description: "Code cleanup and optimization",
  },
  {
    id: "new",
    label: "New Features",
    value: 25,
    color: "#60a5fa",
    percentage: 25,
    description: "New functionality added",
  },
  {
    id: "refactoring",
    label: "Refactoring",
    value: 25,
    color: "#f97316",
    percentage: 25,
    description: "Code restructuring",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    value: 25,
    color: "#a78bfa",
    percentage: 25,
    description: "Bug fixes and updates",
  },
];

const featureHeavyData: QuadrantData[] = [
  {
    id: "refinement",
    label: "Refinement",
    value: 5,
    color: "#4ade80",
    percentage: 10,
    description: "Code cleanup and optimization",
  },
  {
    id: "new",
    label: "New Features",
    value: 30,
    color: "#60a5fa",
    percentage: 60,
    description: "New functionality added",
  },
  {
    id: "refactoring",
    label: "Refactoring",
    value: 10,
    color: "#f97316",
    percentage: 20,
    description: "Code restructuring",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    value: 5,
    color: "#a78bfa",
    percentage: 10,
    description: "Bug fixes and updates",
  },
];

// Mock PRs for filtered views
const mockPullRequests: PullRequest[] = [
  createMockPR(1, "alice", 200, 50, "TypeScript", "Add user authentication"),
  createMockPR(2, "bob", 150, 30, "JavaScript", "Implement search feature"),
  createMockPR(3, "charlie", 100, 200, "Python", "Refactor API endpoints"),
  createMockPR(4, "alice", 50, 10, "CSS", "Update button styles"),
  createMockPR(5, "david", 300, 100, "TypeScript", "Add payment integration"),
  createMockPR(6, "eve", 20, 5, "HTML", "Fix typo in header"),
  createMockPR(7, "bob", 80, 120, "Go", "Optimize _database queries"),
  createMockPR(8, "charlie", 40, 15, "Rust", "Update dependencies"),
];

const meta = {
  title: "Components/Distribution/Charts",
  component: DistributionCharts,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Distribution charts component that displays contribution data in multiple visualization formats (treemap, donut, bar chart) with interactive filtering capabilities.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DistributionCharts>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper component for stories
const InteractiveWrapper = ({ 
  data, 
  pullRequests = mockPullRequests 
}: { 
  data: QuadrantData[]; 
  pullRequests?: PullRequest[];
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  
  const filteredPRs = selectedQuadrant
    ? pullRequests.filter(() => Math.random() > 0.5) // Mock filtering
    : [];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <DistributionCharts
        data={data}
        onSegmentClick={setSelectedQuadrant}
        filteredPRs={filteredPRs}
        selectedQuadrant={selectedQuadrant}
        pullRequests={pullRequests}
      />
    </div>
  );
};

export const Default: Story = {
  args: {
    data: balancedData,
  },
  render: (args) => <InteractiveWrapper {...args} />,
};

export const BalancedDistribution: Story = {
  args: {
    data: balancedData,
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Shows an even distribution across all quadrants (25% each).",
      },
    },
  },
};

export const FeatureHeavy: Story = {
  args: {
    data: featureHeavyData,
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Shows a distribution heavily weighted towards new features (60%).",
      },
    },
  },
};

export const WithSelectedQuadrant: Story = {
  args: {
    data: balancedData,
  },
  render: () => {
    const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>("new");
    
    const filteredPRs = mockPullRequests.filter((pr) => 
      pr.additions > 100 // Mock filter for new features
    );

    return (
      <div className="w-full max-w-4xl mx-auto">
        <DistributionCharts
          data={balancedData}
          onSegmentClick={setSelectedQuadrant}
          filteredPRs={filteredPRs}
          selectedQuadrant={selectedQuadrant}
          pullRequests={mockPullRequests}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the charts with a pre-selected quadrant and filtered PR list.",
      },
    },
  },
};

export const MobileView: Story = {
  args: {
    data: balancedData,
  },
  render: (args) => <InteractiveWrapper {...args} />,
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    docs: {
      description: {
        story: "Shows how the component adapts to mobile viewports with drawer-based PR lists.",
      },
    },
  },
};

export const EmptyData: Story = {
  args: {
    data: [],
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto">
      <DistributionCharts
        data={[]}
        onSegmentClick={() => {}}
        filteredPRs={[]}
        selectedQuadrant={null}
        pullRequests={[]}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows the component with no data.",
      },
    },
  },
};

export const SingleQuadrant: Story = {
  args: {
    data: [],
  },
  render: () => {
    const singleData: QuadrantData[] = [
      {
        id: "maintenance",
        label: "Maintenance",
        value: 50,
        color: "#a78bfa",
        percentage: 100,
        description: "All contributions are maintenance",
      },
    ];
    
    return <InteractiveWrapper data={singleData} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the charts when all contributions fall into a single quadrant.",
      },
    },
  },
};

export const LargePRList: Story = {
  args: {
    data: balancedData,
  },
  render: () => {
    const manyPRs = Array.from({ length: 100 }, (_, i) =>
      createMockPR(
        i + 1,
        `user${(i % 10) + 1}`,
        Math.random() * 500,
        Math.random() * 200,
        ["TypeScript", "JavaScript", "Python", "Go", "Rust"][i % 5],
        `Feature ${i + 1}: ${["Add", "Update", "Fix", "Refactor"][i % 4]} something`
      )
    );

    return <InteractiveWrapper data={balancedData} pullRequests={manyPRs} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the component with a large number of PRs to test scrolling and performance.",
      },
    },
  },
};

export const MultiLanguageDistribution: Story = {
  args: {
    data: balancedData,
  },
  render: () => {
    const multiLangPRs: PullRequest[] = [
      createMockPR(1, "polyglot", 200, 50, "TypeScript", "TypeScript feature"),
      createMockPR(2, "polyglot", 150, 30, "Python", "Python script"),
      createMockPR(3, "polyglot", 100, 20, "Go", "Go microservice"),
      createMockPR(4, "polyglot", 80, 15, "Rust", "Rust optimization"),
      createMockPR(5, "polyglot", 60, 10, "Java", "Java update"),
      createMockPR(6, "polyglot", 40, 5, "CSS", "Style improvements"),
    ];

    return <InteractiveWrapper data={balancedData} pullRequests={multiLangPRs} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows PRs with various programming languages, displaying language indicators.",
      },
    },
  },
};

export const TreemapFocused: Story = {
  args: {
    data: balancedData,
  },
  render: () => {
    const [selectedQuadrant] = useState<string | null>(null);
    
    return (
      <div className="w-full max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground mb-4">
          The treemap view is selected by default. Click on quadrants to drill down into contributor details.
        </p>
        <DistributionCharts
          data={balancedData}
          onSegmentClick={() => {}}
          filteredPRs={[]}
          selectedQuadrant={selectedQuadrant}
          pullRequests={mockPullRequests}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Highlights the treemap visualization with drill-down capabilities.",
      },
    },
  },
};