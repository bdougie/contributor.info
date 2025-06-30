import type { Meta, StoryObj } from "@storybook/react";
import { ExampleRepos } from "./example-repos";
import { action } from "@storybook/addon-actions";

const meta = {
  title: "Features/Repository/ExampleRepos",
  component: ExampleRepos,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A component that displays a list of popular example repositories as clickable buttons. Useful for providing quick access to commonly analyzed repositories."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    onSelect: {
      action: "repository-selected",
      description: "Callback function called when a repository is selected"
    }
  }
} satisfies Meta<typeof ExampleRepos>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <ExampleRepos {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Default display of popular example repositories."
      }
    }
  }
};

export const Interactive: Story = {
  args: {
    onSelect: (repo: string) => {
      console.log(`Selected repository: ${repo}`);
      action("repository-selected")(repo);
    }
  },
  render: (args) => {
    const InteractiveExample = () => {
      const handleSelect = (repo: string) => {
        alert(`You selected: ${repo}`);
        args.onSelect(repo);
      };

      return (
        <div className="w-[600px] p-4">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Click any repository below to see the selection in action
            </p>
          </div>
          <ExampleRepos onSelect={handleSelect} />
        </div>
      );
    };

    return <InteractiveExample />;
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive version that shows alerts when repositories are selected."
      }
    }
  }
};

export const InSearchContext: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      {/* Simulate search input context */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Search for a repository
        </label>
        <input
          type="text"
          placeholder="Search repositories (e.g., facebook/react)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <ExampleRepos {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Example repos component shown in context with a search input field."
      }
    }
  }
};

export const CustomRepositories: Story = {
  args: {
    onSelect: action("custom-repository-selected")
  },
  render: () => {
    // Create a variant with different example repositories
    const CustomExampleRepos = ({ onSelect }: { onSelect: (repo: string) => void }) => {
      const customExamples = [
        "microsoft/vscode",
        "nodejs/node",
        "vercel/next.js",
        "sveltejs/svelte",
        "tailwindlabs/tailwindcss",
      ];

      return (
        <div className="flex flex-wrap gap-2 mt-4 w-full">
          <div className="w-full text-sm text-muted-foreground mb-1">
            Frontend frameworks:
          </div>
          {customExamples.map((example) => (
            <button
              key={example}
              onClick={() => onSelect(example)}
              className="px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      );
    };

    return (
      <div className="w-[600px] p-4">
        <CustomExampleRepos onSelect={action("custom-repository-selected")} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Example of how the component could be customized with different repository categories."
      }
    }
  }
};

export const ResponsiveLayout: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => (
    <div className="w-full max-w-4xl p-4">
      <ExampleRepos {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Component in a responsive layout showing how buttons wrap on different screen sizes."
      }
    }
  }
};

export const MobileView: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => (
    <div className="w-full p-4">
      <ExampleRepos {...args} />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Example repositories component on mobile devices."
      }
    }
  }
};

export const CompactView: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => {
    // Simulate compact version with fewer examples
    const CompactExampleRepos = ({ onSelect }: { onSelect: (repo: string) => void }) => {
      const compactExamples = [
        "facebook/react",
        "microsoft/vscode",
        "nodejs/node"
      ];

      return (
        <div className="flex flex-wrap gap-2 mt-4 w-full">
          <div className="w-full text-sm text-muted-foreground mb-1">
            Quick examples:
          </div>
          {compactExamples.map((example) => (
            <button
              key={example}
              onClick={() => onSelect(example)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      );
    };

    return (
      <div className="w-[400px] p-4">
        <CompactExampleRepos onSelect={args.onSelect} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Compact version with fewer example repositories for smaller spaces."
      }
    }
  }
};

export const WithLoadingState: Story = {
  args: {
    onSelect: action("repository-selected")
  },
  render: (args) => {
    const LoadingStateExample = () => {
      const handleSelect = (repo: string) => {
        // Simulate loading state when clicking
        console.log(`Loading repository: ${repo}...`);
        args.onSelect(repo);
      };

      return (
        <div className="w-[600px] p-4">
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              In a real application, clicking would trigger navigation to the repository page
            </p>
          </div>
          <ExampleRepos onSelect={handleSelect} />
        </div>
      );
    };

    return <LoadingStateExample />;
  },
  parameters: {
    docs: {
      description: {
        story: "Example showing how the component works in a realistic application context."
      }
    }
  }
};