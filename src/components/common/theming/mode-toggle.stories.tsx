import type { Meta, StoryObj } from "@storybook/react";
import { ModeToggle } from "./mode-toggle";
import { ThemeProvider } from "./theme-provider";

const meta = {
  title: "Common/Theming/ModeToggle",
  component: ModeToggle,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A dropdown toggle button to switch between light, dark, and system themes.",
      },
    },
    // Skip smoke tests for this component
    test: {
      disableSnapshots: true,
      skip: false,
    },
  },
  tags: ["autodocs", "skip-test"],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InDarkMode: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark">
        <div className="dark">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export const InLightMode: Story = {
  parameters: {
    backgrounds: { default: "light" },
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <div className="light">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};