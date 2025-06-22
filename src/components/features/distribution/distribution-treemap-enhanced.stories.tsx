import type { Meta, StoryObj } from "@storybook/react";
import { DistributionTreemapEnhanced } from "./distribution-treemap-enhanced";
import { useState } from "react";

// Mock hierarchical data structures
const createContributorNode = (id: string, login: string, prCount: number) => ({
  id,
  name: login,
  value: prCount,
  login,
  avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
  prs: Array.from({ length: prCount }, (_, i) => ({
    id: i + 1,
    number: i + 1,
    title: `PR ${i + 1}: ${["Add", "Update", "Fix", "Refactor"][i % 4]} feature`,
  })),
});

const mockOverviewData = {
  name: "Distribution",
  children: [
    {
      id: "refinement",
      name: "Refinement",
      value: 45,
      color: "#4ade80",
      children: [
        createContributorNode("1", "alice", 20),
        createContributorNode("2", "bob", 15),
        createContributorNode("3", "charlie", 10),
      ],
    },
    {
      id: "new",
      name: "New Features",
      value: 80,
      color: "#60a5fa",
      children: [
        createContributorNode("4", "david", 30),
        createContributorNode("5", "eve", 25),
        createContributorNode("6", "frank", 15),
        createContributorNode("7", "grace", 10),
      ],
    },
    {
      id: "refactoring",
      name: "Refactoring",
      value: 35,
      color: "#f97316",
      children: [
        createContributorNode("8", "henry", 20),
        createContributorNode("9", "iris", 15),
      ],
    },
    {
      id: "maintenance",
      name: "Maintenance",
      value: 60,
      color: "#a78bfa",
      children: [
        createContributorNode("10", "jack", 25),
        createContributorNode("11", "kate", 20),
        createContributorNode("12", "liam", 15),
      ],
    },
  ],
};

const mockDataWithOthers = {
  name: "Distribution",
  children: [
    {
      id: "new",
      name: "New Features",
      value: 150,
      color: "#60a5fa",
      children: [
        createContributorNode("1", "supercontributor", 50),
        createContributorNode("2", "megadev", 40),
        createContributorNode("3", "prolific", 30),
        createContributorNode("4", "active", 20),
        {
          id: "others",
          name: "Others (15)",
          value: 10,
          login: "others",
          avatar_url: "",
          prs: [],
        },
      ],
    },
  ],
};

const meta = {
  title: "Components/Distribution/TreemapEnhanced",
  component: DistributionTreemapEnhanced,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Enhanced treemap visualization for distribution data with drill-down capabilities, contributor avatars, and interactive navigation.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DistributionTreemapEnhanced>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for drill-down functionality
const InteractiveWrapper = ({ 
  initialData = mockOverviewData,
  initialView = "overview" as const,
  initialQuadrant = null as string | null,
}) => {
  const [currentView, setCurrentView] = useState<"overview" | "quadrant">(initialView);
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(initialQuadrant);

  const handleDrillDown = (quadrantId: string) => {
    setSelectedQuadrant(quadrantId);
    setCurrentView("quadrant");
  };

  const handleDrillUp = () => {
    setSelectedQuadrant(null);
    setCurrentView("overview");
  };

  const handleNodeClick = (_nodeId: string) => {
    // Node click handler
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <DistributionTreemapEnhanced
        data={initialData}
        currentView={currentView}
        selectedQuadrant={selectedQuadrant}
        onDrillDown={handleDrillDown}
        onDrillUp={handleDrillUp}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
};

export const Overview: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => <InteractiveWrapper />,
  parameters: {
    docs: {
      description: {
        story: "Shows the treemap in overview mode with all quadrants visible. Click on any quadrant to drill down.",
      },
    },
  },
};

export const QuadrantView: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => (
    <InteractiveWrapper 
      initialView="overview" 
      initialQuadrant="new" 
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows the treemap drilled down into a specific quadrant (New Features) with contributor avatars.",
      },
    },
  },
};

export const WithOthersNode: Story = {
  args: {
    data: mockDataWithOthers,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => (
    <InteractiveWrapper 
      initialData={mockDataWithOthers}
      initialView="overview"
      initialQuadrant="new"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows a quadrant view with an 'Others' node representing contributors beyond the top 20.",
      },
    },
  },
};

export const BalancedDistribution: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => {
    const balancedData = {
      name: "Distribution",
      children: [
        {
          id: "refinement",
          name: "Refinement",
          value: 50,
          color: "#4ade80",
          children: [],
        },
        {
          id: "new",
          name: "New Features",
          value: 50,
          color: "#60a5fa",
          children: [],
        },
        {
          id: "refactoring",
          name: "Refactoring",
          value: 50,
          color: "#f97316",
          children: [],
        },
        {
          id: "maintenance",
          name: "Maintenance",
          value: 50,
          color: "#a78bfa",
          children: [],
        },
      ],
    };
    
    return <InteractiveWrapper initialData={balancedData} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a perfectly balanced distribution with equal values across all quadrants.",
      },
    },
  },
};

export const SingleDominantQuadrant: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => {
    const dominantData = {
      name: "Distribution",
      children: [
        {
          id: "refinement",
          name: "Refinement",
          value: 5,
          color: "#4ade80",
          children: [],
        },
        {
          id: "new",
          name: "New Features",
          value: 180,
          color: "#60a5fa",
          children: [],
        },
        {
          id: "refactoring",
          name: "Refactoring",
          value: 10,
          color: "#f97316",
          children: [],
        },
        {
          id: "maintenance",
          name: "Maintenance",
          value: 5,
          color: "#a78bfa",
          children: [],
        },
      ],
    };
    
    return <InteractiveWrapper initialData={dominantData} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a distribution where one quadrant (New Features) dominates with 90% of contributions.",
      },
    },
  },
};

export const ManyContributors: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => {
    const manyContributorsData = {
      name: "Distribution",
      children: [
        {
          id: "new",
          name: "New Features",
          value: 200,
          color: "#60a5fa",
          children: Array.from({ length: 30 }, (_, i) => 
            createContributorNode(`${i + 1}`, `contributor${i + 1}`, Math.floor(Math.random() * 10) + 1)
          ),
        },
      ],
    };
    
    return (
      <InteractiveWrapper 
        initialData={manyContributorsData}
        initialView="overview"
        initialQuadrant="new"
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a quadrant with many contributors to test layout and avatar sizing.",
      },
    },
  },
};

export const EmptyQuadrants: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => {
    const sparseData = {
      name: "Distribution",
      children: [
        {
          id: "refinement",
          name: "Refinement",
          value: 0,
          color: "#4ade80",
          children: [],
        },
        {
          id: "new",
          name: "New Features",
          value: 25,
          color: "#60a5fa",
          children: [createContributorNode("1", "onlycontributor", 25)],
        },
        {
          id: "refactoring",
          name: "Refactoring",
          value: 0,
          color: "#f97316",
          children: [],
        },
        {
          id: "maintenance",
          name: "Maintenance",
          value: 0,
          color: "#a78bfa",
          children: [],
        },
      ],
    };
    
    return <InteractiveWrapper initialData={sparseData} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows a distribution where some quadrants have no contributions.",
      },
    },
  },
};

export const NavigationDemo: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => {
    const [log, setLog] = useState<string[]>([]);
    
    const LoggingWrapper = () => {
      const [currentView, setCurrentView] = useState<"overview" | "quadrant">("overview");
      const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

      const handleDrillDown = (quadrantId: string) => {
        setLog(prev => [...prev, `Drilled down to: ${quadrantId}`]);
        setSelectedQuadrant(quadrantId);
        setCurrentView("quadrant");
      };

      const handleDrillUp = () => {
        setLog(prev => [...prev, "Drilled up to overview"]);
        setSelectedQuadrant(null);
        setCurrentView("overview");
      };

      const handleNodeClick = (nodeId: string) => {
        setLog(prev => [...prev, `Clicked contributor: ${nodeId}`]);
      };

      return (
        <>
          <div className="w-full max-w-4xl mx-auto">
            <DistributionTreemapEnhanced
              data={mockOverviewData}
              currentView={currentView}
              selectedQuadrant={selectedQuadrant}
              onDrillDown={handleDrillDown}
              onDrillUp={handleDrillUp}
              onNodeClick={handleNodeClick}
            />
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Navigation Log:</h4>
            <div className="space-y-1 text-sm">
              {log.length === 0 ? (
                <p className="text-muted-foreground">Click on quadrants and contributors to see navigation events</p>
              ) : (
                log.map((entry, i) => (
                  <div key={i} className="font-mono">
                    {entry}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      );
    };

    return <LoggingWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive demo showing navigation events and drill-down/up functionality.",
      },
    },
  },
};

export const MobileView: Story = {
  args: {
    data: mockOverviewData,
    currentView: "overview",
    selectedQuadrant: null,
    onDrillDown: () => {},
    onDrillUp: () => {},
  },
  render: () => <InteractiveWrapper />,
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    docs: {
      description: {
        story: "Shows how the treemap adapts to mobile viewports.",
      },
    },
  },
};