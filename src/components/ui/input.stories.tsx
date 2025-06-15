import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Input } from "./input";

const meta = {
  title: "UI/Forms/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A basic input field component with support for all HTML input types.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url"],
      description: "The type of input",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text for the input",
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Enter text...",
  },
};

export const Email: Story = {
  args: {
    type: "email",
    placeholder: "email@example.com",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
  },
};

export const Number: Story = {
  args: {
    type: "number",
    placeholder: "0",
  },
};

export const Search: Story = {
  args: {
    type: "search",
    placeholder: "Search...",
  },
};

export const Disabled: Story = {
  args: {
    type: "text",
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const WithValue: Story = {
  args: {
    type: "text",
    defaultValue: "Pre-filled value",
  },
};

export const FileInput: Story = {
  args: {
    type: "file",
  },
};

export const TypeInteraction: Story = {
  args: {
    type: "text",
    placeholder: "Type something...",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Check that the input is present
    await expect(input).toBeInTheDocument();

    // Test typing in the input
    await userEvent.click(input);
    await userEvent.type(input, "Hello, World!");

    // Check that the value was typed
    await expect(input).toHaveValue("Hello, World!");

    // Test clearing the input
    await userEvent.clear(input);
    await expect(input).toHaveValue("");
  },
  tags: ["interaction"],
};

export const EmailValidation: Story = {
  args: {
    type: "email",
    placeholder: "email@example.com",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Test typing an invalid email
    await userEvent.click(input);
    await userEvent.type(input, "invalid-email");

    // Test typing a valid email
    await userEvent.clear(input);
    await userEvent.type(input, "test@example.com");
    await expect(input).toHaveValue("test@example.com");
  },
  tags: ["interaction"],
};

export const PasswordInteraction: Story = {
  args: {
    type: "password",
    placeholder: "Enter password...",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input =
      canvas.getByLabelText(/password/i) || canvas.getByRole("textbox");

    // Test typing in password field
    await userEvent.click(input);
    await userEvent.type(input, "secretpassword123");

    // Check that the value was entered (even though it's hidden)
    await expect(input).toHaveValue("secretpassword123");
  },
  tags: ["interaction"],
};

export const DisabledInput: Story = {
  args: {
    type: "text",
    placeholder: "Disabled input",
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Check that the input is disabled
    await expect(input).toBeDisabled();

    // Try to type (should not work)
    await userEvent.click(input);
    await userEvent.type(input, "This should not appear");
    await expect(input).toHaveValue("");
  },
  tags: ["interaction"],
};
