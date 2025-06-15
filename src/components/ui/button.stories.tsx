import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { waitForFocus } from "@/lib/test-utils";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    asChild: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Destructive",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost",
  },
};

export const Link: Story = {
  args: {
    variant: "link",
    children: "Link",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large",
  },
};

export const Icon: Story = {
  args: {
    size: "icon",
    children: "⚡",
  },
};

export const WithInteraction: Story = {
  args: {
    children: "Click me!",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    // Check that the button is present
    await expect(button).toBeInTheDocument();

    // Check that the button has the correct text
    await expect(button).toHaveTextContent("Click me!");

    // Test clicking the button
    await userEvent.click(button);

    // Check that the button can be focused
    button.focus();
    await waitForFocus(button);
    await expect(button).toHaveFocus();
  },
  tags: ["interaction"],
};

export const DisabledInteraction: Story = {
  args: {
    children: "Disabled Button",
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    // Check that the button is disabled
    await expect(button).toBeDisabled();

    // Check that disabled button has pointer-events: none (preventing clicks)
    const computedStyle = getComputedStyle(button);
    await expect(computedStyle.pointerEvents).toBe("none");

    // Verify button is not focusable when disabled
    button.focus();
    await expect(button).not.toHaveFocus();
  },
  tags: ["interaction"],
};

export const KeyboardNavigation: Story = {
  args: {
    children: "Keyboard Test",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    // Test direct focus
    button.focus();
    await waitForFocus(button);
    await expect(button).toHaveFocus();

    // Test Enter key activation
    await userEvent.keyboard("{Enter}");

    // Test Space key activation  
    await userEvent.keyboard(" ");

    // Test that button is still focused after keyboard activation
    await expect(button).toHaveFocus();
  },
  tags: ["interaction", "accessibility"],
};
