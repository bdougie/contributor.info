import type { Meta, StoryObj } from "@storybook/react";
import { ContributorIcon } from "./ContributorIcon";
import { LotteryIcon } from "./LotteryIcon";
import { OdometerIcon } from "./OdometerIcon";
import { YoloIcon } from "./YoloIcon";

const AllIcons = () => (
  <div className="grid grid-cols-2 gap-8 p-8">
    <div className="flex flex-col items-center gap-2">
      <ContributorIcon className="w-8 h-8" />
      <span className="text-sm text-muted-foreground">ContributorIcon</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <LotteryIcon className="w-8 h-8" />
      <span className="text-sm text-muted-foreground">LotteryIcon</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <OdometerIcon className="w-8 h-8" />
      <span className="text-sm text-muted-foreground">OdometerIcon</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <YoloIcon className="w-8 h-8" />
      <span className="text-sm text-muted-foreground">YoloIcon</span>
    </div>
  </div>
);

const meta = {
  title: "Icons/All Icons",
  component: AllIcons,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Collection of custom SVG icons used throughout the application.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AllIcons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ContributorIcon_Individual: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <ContributorIcon className="w-6 h-6" />
      <ContributorIcon className="w-8 h-8" />
      <ContributorIcon className="w-12 h-12" />
      <ContributorIcon className="w-16 h-16" />
    </div>
  ),
};

export const LotteryIcon_Individual: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <LotteryIcon className="w-6 h-6" />
      <LotteryIcon className="w-8 h-8" />
      <LotteryIcon className="w-12 h-12" />
      <LotteryIcon className="w-16 h-16" />
    </div>
  ),
};

export const OdometerIcon_Individual: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <OdometerIcon className="w-6 h-6" />
      <OdometerIcon className="w-8 h-8" />
      <OdometerIcon className="w-12 h-12" />
      <OdometerIcon className="w-16 h-16" />
    </div>
  ),
};

export const YoloIcon_Individual: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <YoloIcon className="w-6 h-6" />
      <YoloIcon className="w-8 h-8" />
      <YoloIcon className="w-12 h-12" />
      <YoloIcon className="w-16 h-16" />
    </div>
  ),
};

export const WithColors: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-4">
      <ContributorIcon className="w-8 h-8 text-blue-500" />
      <LotteryIcon className="w-8 h-8 text-green-500" />
      <OdometerIcon className="w-8 h-8 text-purple-500" />
      <YoloIcon className="w-8 h-8 text-red-500" />
    </div>
  ),
};