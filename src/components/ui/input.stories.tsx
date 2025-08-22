import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Input } from "./input";
import { Label } from "./label";

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
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Check that the input is present
    expect(input).toBeInTheDocument();

    // Test typing in the input
    userEvent.click(input);
    userEvent.type(input, "Hello, World!");

    // Check that the value was typed
    expect(input).toHaveValue("Hello, World!");

    // Test clearing the input
    userEvent.clear(input);
    expect(input).toHaveValue("");
  },
  tags: ["interaction"],
};

export const EmailValidation: Story = {
  args: {
    type: "email",
    placeholder: "email@example.com",
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Test typing an invalid email
    userEvent.click(input);
    userEvent.type(input, "invalid-email");

    // Test typing a valid email
    userEvent.clear(input);
    userEvent.type(input, "test@example.com");
    expect(input).toHaveValue("test@example.com");
  },
  tags: ["interaction"],
};

export const PasswordInteraction: Story = {
  args: {
    type: "password",
    placeholder: "Enter password...",
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Password inputs don't have role="textbox", they use the input element directly
    const input = canvas.getByPlaceholderText("Enter password...");

    // Check that it's a password input
    expect(input).toHaveAttribute("type", "password");

    // Test typing in password field
    userEvent.click(input);
    userEvent.type(input, "secretpassword123");

    // Check that the value was entered (even though it's hidden)
    expect(input).toHaveValue("secretpassword123");
  },
  tags: ["interaction"],
};

export const DisabledInput: Story = {
  args: {
    type: "text",
    placeholder: "Disabled input",
    disabled: true,
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");

    // Check that the input is disabled
    expect(input).toBeDisabled();

    // Try to type (should not work)
    userEvent.click(input);
    userEvent.type(input, "This should not appear");
    expect(input).toHaveValue("");
  },
  tags: ["interaction"],
};

export const WithLabelAssociation: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="username-input">Username</Label>
      <Input id="username-input" type="text" placeholder="Enter your username" />
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test that input can be found by its label
    const input = canvas.getByLabelText("Username");
    expect(input).toBeInTheDocument();
    
    // Test that input has correct attributes
    expect(input).toHaveAttribute("id", "username-input");
    expect(input).toHaveAttribute("type", "text");
    
    // Test interaction via label
    const label = canvas.getByText("Username");
    userEvent.click(label);
    expect(input).toHaveFocus();
    
    // Test typing
    userEvent.type(input, "testuser");
    expect(input).toHaveValue("testuser");
  },
  tags: ["interaction", "accessibility"],
};
