import type { Meta, StoryObj } from '@storybook/react';

/**
 * Story Template for Contributor.info Components
 *
 * This template provides a consistent structure for creating Storybook stories
 * across all components in the application.
 *
 * Usage:
 * 1. Copy this template
 * 2. Replace YourComponent with your actual component
 * 3. Update the title path according to your component location
 * 4. Configure parameters based on your component needs
 * 5. Add appropriate decorators for context (themes, providers, etc.)
 * 6. Define your stories following the examples below
 */

// Import your component here
// import { YourComponent } from "./your-component";

/**
 * Meta configuration for the component
 *
 * Title should follow the pattern:
 * - UI/ComponentName (for basic UI components)
 * - Features/Category/ComponentName (for feature components)
 * - Common/Category/ComponentName (for shared components)
 * - Icons/ComponentName (for icon components)
 * - Skeletons/ComponentName (for loading skeletons)
 */
const meta = {
  title: 'Category/YourComponent', // Update this path
  // component: YourComponent, // Uncomment and update
  parameters: {
    layout: 'centered', // or "fullscreen", "padded"
    docs: {
      description: {
        component: `
          Brief description of what this component does and when to use it.
          
          Key features:
          - Feature 1
          - Feature 2
          - Feature 3
        `,
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // Add necessary providers/context here
      // Examples:
      // <ThemeProvider>
      // <TooltipProvider>
      // <RepoStatsContext.Provider value={mockData}>
      <div className="w-[400px] p-4">
        {' '}
        {/* Adjust container as needed */}
        <Story />
      </div>
      // </RepoStatsContext.Provider>
      // </TooltipProvider>
      // </ThemeProvider>
    ),
  ],
  argTypes: {
    // Define argTypes for better controls
    // Example:
    // className: {
    //   control: "text",
    //   description: "Additional CSS classes",
    // },
    // variant: {
    //   control: "select",
    //   options: ["default", "primary", "secondary"],
    //   description: "Visual variant of the component",
    // },
    // disabled: {
    //   control: "boolean",
    //   description: "Whether the component is disabled",
    // },
    // onClick: {
    //   action: "clicked",
    //   description: "Callback fired when component is clicked",
    // },
  },
} satisfies Meta<any>; // Replace 'any' with typeof YourComponent

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default story - should show the component in its most common state
 */
export const Default: Story = {
  args: {
    // Add default props here
  },
};

/**
 * Example story variations:
 */

// Different visual states
export const Primary: Story = {
  args: {
    // variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    // variant: "secondary",
  },
};

// Different data states
export const WithData: Story = {
  args: {
    // Add props with sample data
  },
};

export const Empty: Story = {
  args: {
    // Add props for empty state
  },
};

export const Loading: Story = {
  args: {
    // loading: true,
  },
};

export const Error: Story = {
  args: {
    // Add props for error state
  },
};

// Interactive states
export const Disabled: Story = {
  args: {
    // disabled: true,
  },
};

export const WithInteraction: Story = {
  args: {
    // Add props for interactive story
  },
  play: async ({ canvasElement }) => {
    // Add interaction tests here using @storybook/test
    // const canvas = within(canvasElement);
    // const button = canvas.getByRole("button");
    // await userEvent.click(button);
    // await expect(button).toHaveTextContent("Clicked");
  },
  tags: ['interaction'],
};

// Responsive variations
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
};

export const Desktop: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl p-4">
        <Story />
      </div>
    ),
  ],
};

// Theme variations
export const DarkTheme: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};

// Multiple instances
export const Multiple: Story = {
  render: () => (
    <div className="space-y-4">
      {/* Render multiple instances of your component */}
      {/* <YourComponent {...defaultProps} />
      <YourComponent {...variantProps} />
      <YourComponent {...anotherVariant} /> */}
    </div>
  ),
};

/**
 * Story naming conventions:
 * - Use PascalCase for story names
 * - Be descriptive but concise
 * - Group related stories logically
 *
 * Common story patterns:
 * - Default: Basic usage
 * - [Variant]Name: Different visual variants
 * - With[Data/Feature]: Stories with specific data or features
 * - [State]: Different component states (Loading, Error, Empty)
 * - [Device]: Responsive variations (Mobile, Tablet, Desktop)
 * - [Theme]: Theme variations (Dark, Light)
 * - [Interaction]: Stories with user interactions
 * - Multiple: Multiple instances of the component
 */
