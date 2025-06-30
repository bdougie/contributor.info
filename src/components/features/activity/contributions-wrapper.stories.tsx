import type { Meta, StoryObj } from "@storybook/react";
import ContributionsWrapper from "./contributions-wrapper";

const meta = {
  title: "Features/Activity/ContributionsWrapper",
  component: ContributionsWrapper,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A wrapper component that lazy loads the contributions chart to visualize pull request contributions size and frequency. Includes proper fallback loading states and test environment handling."
      }
    }
  },
  tags: ["autodocs"]
} satisfies Meta<typeof ContributionsWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[800px] p-4">
      <ContributionsWrapper />
    </div>
  )
};

export const Loading: Story = {
  render: () => {
    // Override the lazy import to simulate permanent loading
    const LoadingWrapper = () => {
      return (
        <div className="w-[800px] p-4">
          <div className="border rounded-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Pull Request Contributions</h3>
              <p className="text-sm text-muted-foreground">
                Visualize the size and frequency of contributions
              </p>
            </div>
            <div className="p-6">
              <div className="h-[400px] w-full flex items-center justify-center">
                <span className="text-muted-foreground">Loading chart...</span>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return <LoadingWrapper />;
  }
};

export const TestEnvironment: Story = {
  render: () => {
    // This will show the mock component that appears in test environments
    const TestWrapper = () => {
      return (
        <div className="w-[800px] p-4">
          <div className="border rounded-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Pull Request Contributions</h3>
              <p className="text-sm text-muted-foreground">
                Visualize the size and frequency of contributions
              </p>
            </div>
            <div className="p-6">
              <div data-testid="mock-contributions-chart" className="h-[400px] w-full flex items-center justify-center">
                <span>Mock Contributions Chart</span>
              </div>
            </div>
          </div>
        </div>
      );
    };

    return <TestWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the component appears in test environments with the mock chart."
      }
    }
  }
};

export const Responsive: Story = {
  render: () => (
    <div className="w-full max-w-4xl p-4">
      <ContributionsWrapper />
    </div>  
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Component displayed in a responsive container to test mobile layouts."
      }
    }
  }
};