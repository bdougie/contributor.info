import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const meta = {
  title: "Tests/Accessibility",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Accessibility-focused interaction tests for UI components.",
      },
    },
  },
  tags: ["skip-test"], // TODO: Fix test
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardNavigation: Story = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Keyboard Navigation Test</h2>
      <div className="space-y-2">
        <Button>First Button</Button>
        <Button>Second Button</Button>
        <Input placeholder="Text input" />
        <Button disabled>Disabled Button</Button>
        <Button>Last Button</Button>
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test tab navigation through focusable elements
    const firstButton = canvas.getByRole("button", { name: "First Button" });
    const secondButton = canvas.getByRole("button", { name: "Second Button" });
    const textInput = canvas.getByRole("textbox");
    const disabledButton = canvas.getByRole("button", {
      name: "Disabled Button",
    });
    const lastButton = canvas.getByRole("button", { name: "Last Button" });

    // Start from first button
    firstButton.focus();
    expect(firstButton).toHaveFocus();

    // Tab to second button
    userEvent.keyboard("{Tab}");
    expect(secondButton).toHaveFocus();

    // Tab to input
    userEvent.keyboard("{Tab}");
    expect(textInput).toHaveFocus();

    // Tab should skip disabled button and go to last button
    userEvent.keyboard("{Tab}");
    expect(lastButton).toHaveFocus();

    // Shift+Tab should go back to input (skipping disabled button)
    userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(textInput).toHaveFocus();

    // Verify disabled button is not focusable
    expect(disabledButton).toBeDisabled();
  },
  tags: ["skip-test"], // TODO: Fix keyboard test
};

export const ScreenReaderSupport: Story = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Screen Reader Support Test</h2>
      <div className="space-y-4">
        {/* Form with proper labels */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="Enter your username" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email (required)</Label>
          <Input
            id="email"
            type="email"
            required
            aria-describedby="email-hint"
            placeholder="Enter your email"
          />
          <p id="email-hint" className="text-sm text-muted-foreground">
            We'll never share your email with anyone else.
          </p>
        </div>

        {/* Radio group with proper labeling */}
        <fieldset className="space-y-2">
          <legend id="preference-legend" className="text-sm font-medium">
            Choose your preference
          </legend>
          <RadioGroup defaultValue="email" aria-labelledby="preference-legend">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="email" id="pref-email" />
              <Label htmlFor="pref-email">Email notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sms" id="pref-sms" />
              <Label htmlFor="pref-sms">SMS notifications</Label>
            </div>
          </RadioGroup>
        </fieldset>

        {/* Button with accessible name */}
        <Button aria-describedby="submit-help">Submit Form</Button>
        <p id="submit-help" className="text-sm text-muted-foreground">
          Click to submit your preferences
        </p>
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test proper labeling
    const usernameInput = canvas.getByLabelText("Username");
    expect(usernameInput).toBeInTheDocument();

    const emailInput = canvas.getByLabelText("Email (required)");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toBeRequired();

    // Test aria-describedby relationships
    expect(emailInput).toHaveAttribute("aria-describedby", "email-hint");

    // Test fieldset/legend for radio group
    const radioGroup = canvas.getByRole("radiogroup", {
      name: "Choose your preference",
    });
    expect(radioGroup).toBeInTheDocument();

    // Test radio button labels
    const emailRadio = canvas.getByLabelText("Email notifications");
    const smsRadio = canvas.getByLabelText("SMS notifications");
    expect(emailRadio).toBeInTheDocument();
    expect(smsRadio).toBeInTheDocument();

    // Test button accessible description
    const submitButton = canvas.getByRole("button", { name: "Submit Form" });
    expect(submitButton).toHaveAttribute(
      "aria-describedby",
      "submit-help"
    );
  },
  tags: ["accessibility", "screen-reader"],
};

export const ColorContrastAndVisualCues: Story = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Visual Accessibility Test</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label htmlFor="terms">I agree to the terms and conditions</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            aria-invalid="true"
            aria-describedby="password-error"
          />
          <p id="password-error" className="text-sm text-red-600" role="alert">
            Password must be at least 8 characters long
          </p>
        </div>

        <div className="flex space-x-2">
          <Button variant="default">Primary Action</Button>
          <Button variant="outline">Secondary Action</Button>
          <Button variant="destructive">Danger Action</Button>
        </div>
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test error state indication
    const passwordInput = canvas.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      "password-error"
    );

    // Test error message role
    const errorMessage = canvas.getByRole("alert");
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(
      "Password must be at least 8 characters long"
    );

    // Test checkbox labeling
    const checkbox = canvas.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();

    // Test button variants are distinguishable
    const primaryButton = canvas.getByRole("button", {
      name: "Primary Action",
    });
    const secondaryButton = canvas.getByRole("button", {
      name: "Secondary Action",
    });
    const dangerButton = canvas.getByRole("button", { name: "Danger Action" });

    expect(primaryButton).toBeInTheDocument();
    expect(secondaryButton).toBeInTheDocument();
    expect(dangerButton).toBeInTheDocument();
  },
  tags: ["accessibility", "visual"],
};

export const FocusManagement: Story = {
  render: () => {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Focus Management Test</h2>
        <div className="space-y-2">
          <Button>Button 1</Button>
          <Button>Button 2</Button>
          <Button>Button 3</Button>
        </div>
      </div>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test visible focus indicators
    const button1 = canvas.getByRole("button", { name: "Button 1" });
    const button2 = canvas.getByRole("button", { name: "Button 2" });
    const button3 = canvas.getByRole("button", { name: "Button 3" });

    // Focus each button and verify it receives focus
    button1.focus();
    expect(button1).toHaveFocus();

    button2.focus();
    expect(button2).toHaveFocus();

    button3.focus();
    expect(button3).toHaveFocus();

    // Test tab order
    button1.focus();
    userEvent.keyboard("{Tab}");
    expect(button2).toHaveFocus();

    userEvent.keyboard("{Tab}");
    expect(button3).toHaveFocus();
  },
  tags: ["skip-test"], // TODO: Fix focus test
};
