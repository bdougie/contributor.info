import type { Meta, StoryObj } from "@storybook/react";
import { QuadrantStats } from "./quadrant-stats";
import type { QuadrantData } from "@/lib/types";

// Mock quadrant data sets
const balancedQuadrantData: QuadrantData[] = [
  {
    name: "Core",
    count: 145,
    percentage: 35.2,
    color: "#ef4444",
    description: "Critical system files"
  },
  {
    name: "Peripheral",
    count: 89,
    percentage: 21.6,
    color: "#f97316", 
    description: "Supporting functionality"
  },
  {
    name: "Supplemental",
    count: 112,
    percentage: 27.1,
    color: "#eab308",
    description: "Additional features"
  },
  {
    name: "Trivial",
    count: 67,
    percentage: 16.1,
    color: "#22c55e",
    description: "Documentation and tests"
  }
];

const coreHeavyQuadrantData: QuadrantData[] = [
  {
    name: "Core",
    count: 320,
    percentage: 68.4,
    color: "#ef4444",
    description: "Critical system files"
  },
  {
    name: "Peripheral", 
    count: 78,
    percentage: 16.7,
    color: "#f97316",
    description: "Supporting functionality"
  },
  {
    name: "Supplemental",
    count: 45,
    percentage: 9.6,
    color: "#eab308",
    description: "Additional features"
  },
  {
    name: "Trivial",
    count: 25,
    percentage: 5.3,
    color: "#22c55e",
    description: "Documentation and tests"
  }
];

const documentationHeavyData: QuadrantData[] = [
  {
    name: "Core",
    count: 23,
    percentage: 8.1,
    color: "#ef4444",
    description: "Critical system files"
  },
  {
    name: "Peripheral",
    count: 31,
    percentage: 10.9,
    color: "#f97316",
    description: "Supporting functionality"  
  },
  {
    name: "Supplemental",
    count: 67,
    percentage: 23.6,
    color: "#eab308",
    description: "Additional features"
  },
  {
    name: "Trivial",
    count: 163,
    percentage: 57.4,
    color: "#22c55e",
    description: "Documentation and tests"
  }
];

const emptyQuadrantData: QuadrantData[] = [
  {
    name: "Core",
    count: 0,
    percentage: 0,
    color: "#ef4444",
    description: "Critical system files"
  },
  {
    name: "Peripheral",
    count: 0,
    percentage: 0,
    color: "#f97316",
    description: "Supporting functionality"
  },
  {
    name: "Supplemental",
    count: 0,
    percentage: 0,
    color: "#eab308",
    description: "Additional features"
  },
  {
    name: "Trivial",
    count: 0,
    percentage: 0,
    color: "#22c55e",
    description: "Documentation and tests"
  }
];

const singleQuadrantData: QuadrantData[] = [
  {
    name: "Core",
    count: 1,
    percentage: 100,
    color: "#ef4444",
    description: "Critical system files"
  },
  {
    name: "Peripheral",
    count: 0,
    percentage: 0,
    color: "#f97316",
    description: "Supporting functionality"
  },
  {
    name: "Supplemental",
    count: 0,
    percentage: 0,
    color: "#eab308",
    description: "Additional features"
  },
  {
    name: "Trivial",
    count: 0,
    percentage: 0,
    color: "#22c55e",
    description: "Documentation and tests"
  }
];

const meta = {
  title: "Features/Health/QuadrantStats",
  component: QuadrantStats,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A component that displays repository file statistics across four quadrants: Core, Peripheral, Supplemental, and Trivial. Shows both percentage and absolute counts for each category."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    data: {
      control: false,
      description: "Array of quadrant data with name, count, percentage, and color"
    }
  }
} satisfies Meta<typeof QuadrantStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  args: {
    data: balancedQuadrantData
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Balanced distribution across all four quadrants showing healthy codebase diversity."
      }
    }
  }
};

export const CoreHeavy: Story = {
  args: {
    data: coreHeavyQuadrantData
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Core-heavy distribution indicating a codebase with lots of critical files."
      }
    }
  }
};

export const DocumentationHeavy: Story = {
  args: {
    data: documentationHeavyData
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Documentation-heavy distribution common in well-documented projects or libraries."
      }
    }
  }
};

export const EmptyRepository: Story = {
  args: {
    data: emptyQuadrantData
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Empty repository with no files in any quadrant."
      }
    }
  }
};

export const SingleFile: Story = {
  args: {
    data: singleQuadrantData
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository with only a single core file."
      }
    }
  }
};

export const HighVolume: Story = {
  args: {
    data: [
      {
        name: "Core",
        count: 2847,
        percentage: 42.3,
        color: "#ef4444",
        description: "Critical system files"
      },
      {
        name: "Peripheral",
        count: 1926,
        percentage: 28.6,
        color: "#f97316",
        description: "Supporting functionality"
      },
      {
        name: "Supplemental",
        count: 1204,
        percentage: 17.9,
        color: "#eab308",
        description: "Additional features"
      },
      {
        name: "Trivial",
        count: 756,
        percentage: 11.2,
        color: "#22c55e",
        description: "Documentation and tests"
      }
    ]
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Large repository with thousands of files across quadrants."
      }
    }
  }
};

export const CompactView: Story = {
  args: {
    data: balancedQuadrantData
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Compact view showing responsive layout in smaller container."
      }
    }
  }
};

export const MobileView: Story = {
  args: {
    data: balancedQuadrantData
  },
  render: (args) => (
    <div className="w-full p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Quadrant stats on mobile devices with single-column layout."
      }
    }
  }
};

export const CustomColors: Story = {
  args: {
    data: [
      {
        name: "Core",
        count: 145,
        percentage: 35.2,
        color: "#8b5cf6",
        description: "Critical system files"
      },
      {
        name: "Peripheral",
        count: 89,
        percentage: 21.6,
        color: "#06b6d4",
        description: "Supporting functionality"
      },
      {
        name: "Supplemental",
        count: 112,
        percentage: 27.1,
        color: "#84cc16",
        description: "Additional features"
      },
      {
        name: "Trivial",
        count: 67,
        percentage: 16.1,
        color: "#f59e0b",
        description: "Documentation and tests"
      }
    ]
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Example with custom color scheme for different themes."
      }
    }
  }
};

export const DecimalPrecision: Story = {
  args: {
    data: [
      {
        name: "Core",
        count: 7,
        percentage: 33.33,
        color: "#ef4444",
        description: "Critical system files"
      },
      {
        name: "Peripheral",
        count: 5,
        percentage: 23.81,
        color: "#f97316",
        description: "Supporting functionality"
      },
      {
        name: "Supplemental",
        count: 6,
        percentage: 28.57,
        color: "#eab308",
        description: "Additional features"
      },
      {
        name: "Trivial",
        count: 3,
        percentage: 14.29,
        color: "#22c55e",
        description: "Documentation and tests"
      }
    ]
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <QuadrantStats {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Small repository showing decimal precision in percentages."
      }
    }
  }
};