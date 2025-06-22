import type { Meta, StoryObj } from "@storybook/react";
import { VelocityCard } from "./velocity-card";

const meta = {
  title: "Features/Activity/VelocityCard",
  component: VelocityCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A card component that displays weekly pull request velocity metrics with comparison to the previous week.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[300px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    loading: {
      control: "boolean",
      description: "Whether the card is in a loading state",
    },
    velocity: {
      description: "Velocity data object containing current, previous, and change values",
    },
  },
} satisfies Meta<typeof VelocityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    velocity: {
      current: 12,
      previous: 8,
      change: 50,
    },
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    velocity: {
      current: 0,
      previous: 0,
      change: 0,
    },
    loading: true,
  },
};

export const HighVelocity: Story = {
  args: {
    velocity: {
      current: 45,
      previous: 32,
      change: 40.6,
    },
    loading: false,
  },
};

export const DecreasingVelocity: Story = {
  args: {
    velocity: {
      current: 3,
      previous: 8,
      change: -62.5,
    },
    loading: false,
  },
};

export const NoChange: Story = {
  args: {
    velocity: {
      current: 10,
      previous: 10,
      change: 0,
    },
    loading: false,
  },
};

export const LowVelocity: Story = {
  args: {
    velocity: {
      current: 1,
      previous: 0,
      change: 100,
    },
    loading: false,
  },
};

export const VeryHighVelocity: Story = {
  args: {
    velocity: {
      current: 87,
      previous: 45,
      change: 93.3,
    },
    loading: false,
  },
};