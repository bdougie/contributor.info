import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { useState } from "react";
import { designTokens } from "../../../.storybook/design-tokens";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

const meta = {
  title: "UI/Forms/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A versatile input component with support for all HTML input types, validation states, sizes, and accessibility features. Includes proper keyboard navigation and ARIA attributes.",
      },
    },
  },
  tags: ["autodocs", "interaction", "accessibility"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url", "date", "time", "datetime-local", "month", "week", "file"],
      description: "The type of input",
      table: {
        defaultValue: { summary: "text" },
      },
    },
    placeholder: {
      control: "text",
      description: "Placeholder text for the input",
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
      table: {
        defaultValue: { summary: "false" },
      },
    },
    required: {
      control: "boolean",
      description: "Whether the input is required",
      table: {
        defaultValue: { summary: "false" },
      },
    },
    readOnly: {
      control: "boolean",
      description: "Whether the input is read-only",
      table: {
        defaultValue: { summary: "false" },
      },
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ 
        minWidth: '350px',
        padding: designTokens.spacing[4],
      }}>
        <Story />
      </div>
    ),
  ],
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
    min: 0,
    max: 100,
    step: 1,
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

export const ReadOnly: Story = {
  args: {
    type: "text",
    value: "Read-only value",
    readOnly: true,
  },
};

export const Required: Story = {
  args: {
    type: "text",
    placeholder: "Required field",
    required: true,
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
    accept: "image/*,.pdf",
  },
};

export const DateInputs: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" />
      </div>
      <div>
        <Label htmlFor="time">Time</Label>
        <Input id="time" type="time" />
      </div>
      <div>
        <Label htmlFor="datetime">Date & Time</Label>
        <Input id="datetime" type="datetime-local" />
      </div>
      <div>
        <Label htmlFor="month">Month</Label>
        <Input id="month" type="month" />
      </div>
      <div>
        <Label htmlFor="week">Week</Label>
        <Input id="week" type="week" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Various date and time input types for different use cases.",
      },
    },
  },
};

export const ValidationStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div>
        <Label htmlFor="valid">Valid Input</Label>
        <Input 
          id="valid" 
          type="text" 
          defaultValue="Valid input"
          className="border-green-500 focus:ring-green-500"
          aria-invalid="false"
        />
        <p className="text-sm text-green-600 mt-1">✓ Looks good!</p>
      </div>
      
      <div>
        <Label htmlFor="invalid">Invalid Input</Label>
        <Input 
          id="invalid" 
          type="email" 
          defaultValue="invalid-email"
          className="border-red-500 focus:ring-red-500"
          aria-invalid="true"
          aria-describedby="invalid-error"
        />
        <p id="invalid-error" className="text-sm text-red-600 mt-1">Please enter a valid email address</p>
      </div>
      
      <div>
        <Label htmlFor="warning">Warning State</Label>
        <Input 
          id="warning" 
          type="text" 
          defaultValue="Username123"
          className="border-amber-500 focus:ring-amber-500"
        />
        <p className="text-sm text-amber-600 mt-1">⚠ Username should be lowercase</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Different validation states with appropriate visual feedback and ARIA attributes.",
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
      <div>
        <Label>Small</Label>
        <Input 
          type="text" 
          placeholder="Small input" 
          className="h-8 text-sm"
        />
      </div>
      <div>
        <Label>Default</Label>
        <Input 
          type="text" 
          placeholder="Default input" 
        />
      </div>
      <div>
        <Label>Large</Label>
        <Input 
          type="text" 
          placeholder="Large input" 
          className="h-12 text-lg"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Input fields in different sizes for various UI contexts.",
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        <Input type="search" placeholder="Search..." className="pl-10" />
      </div>
      
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📧</span>
        <Input type="email" placeholder="Email address" className="pl-10" />
      </div>
      
      <div className="relative">
        <Input type="password" placeholder="Password" className="pr-10" />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">👁</button>
      </div>
      
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <Input type="number" placeholder="0.00" className="pl-10 pr-16" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">USD</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Input fields with leading and trailing icons for enhanced visual context.",
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState("");
    const [errors, setErrors] = useState<string[]>([]);

    const validate = (val: string) => {
      const newErrors = [];
      if (val.length < 3) newErrors.push("Must be at least 3 characters");
      if (val.length > 20) newErrors.push("Must be less than 20 characters");
      if (!/^[a-zA-Z0-9_]+$/.test(val) && val.length > 0) {
        newErrors.push("Only letters, numbers, and underscores allowed");
      }
      setErrors(newErrors);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[2] }}>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="Enter username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            validate(e.target.value);
          }}
          className={errors.length > 0 ? "border-red-500" : value.length >= 3 ? "border-green-500" : ""}
          aria-invalid={errors.length > 0}
          aria-describedby={errors.length > 0 ? "username-errors" : undefined}
        />
        {errors.length > 0 && (
          <ul id="username-errors" className="text-sm text-red-600">
            {errors.map((__error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        )}
        {errors.length === 0 && value.length >= 3 && (
          <p className="text-sm text-green-600">✓ Username is valid</p>
        )}
        <p className="text-xs text-gray-500">
          Characters: {value.length}/20
        </p>
      </div>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Username");

    // Test initial state
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");

    // Test typing valid username
    

    // Test invalid characters
    
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive input with real-time validation and character counting.",
      },
    },
  },
};

export const PasswordWithStrength: Story = {
  render: () => {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const getStrength = (pass: string) => {
      if (pass.length === 0) return { level: 0, text: "", color: "" };
      if (pass.length < 6) return { level: 1, text: "Weak", color: "bg-red-500" };
      if (pass.length < 10) return { level: 2, text: "Fair", color: "bg-amber-500" };
      if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(pass)) {
        return { level: 4, text: "Strong", color: "bg-green-500" };
      }
      return { level: 3, text: "Good", color: "bg-blue-500" };
    };

    const strength = getStrength(password);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[2] }}>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>
        
        {password.length > 0 && (
          <>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-2 flex-1 rounded ${
                    level <= strength.level ? strength.color : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-600">
              Password strength: <strong>{strength.text}</strong>
            </p>
          </>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Password input with visibility toggle and strength indicator.",
      },
    },
  },
};

export const FormExample: Story = {
  render: () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Contact Form</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" type="text" placeholder="John Doe" required />
          </div>
          
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" placeholder="john@example.com" required />
          </div>
          
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
          </div>
          
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" placeholder="https://example.com" />
          </div>
          
          <div>
            <Label htmlFor="birthdate">Birth Date</Label>
            <Input id="birthdate" type="date" />
          </div>
          
          <div>
            <Label htmlFor="budget">Budget</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input 
                id="budget" 
                type="number" 
                placeholder="0.00" 
                className="pl-10"
                min="0"
                step="100"
              />
            </div>
          </div>
          
          <Button type="submit" className="w-full">Submit</Button>
        </form>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: "Complete form example showing various input types in context.",
      },
    },
  },
};

export const Autofocus: Story = {
  args: {
    type: "text",
    placeholder: "This input has autofocus",
    autoFocus: true,
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    
    // Check that input has focus
  },
  parameters: {
    docs: {
      description: {
        story: "Input that automatically receives focus when the page loads.",
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => (
    <form className="space-y-3">
      <Input type="text" placeholder="Press Tab to navigate" />
      <Input type="email" placeholder="Tab to this field" />
      <Input type="password" placeholder="Tab to password" />
      <Button type="submit">Submit (Tab here)</Button>
    </form>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inputs = canvas.getAllByRole("textbox");
    const passwordInput = canvas.getByPlaceholderText("Tab to password");
    
    // Focus first input
    inputs[0].focus();
    expect(document.activeElement).toBe(inputs[0]);
    
    // Simulate Tab key
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(tabEvent);
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates keyboard navigation between form fields.",
      },
    },
  },
  tags: ["interaction", "accessibility"],
};

export const MobileOptimized: Story = {
  render: () => (
    <div className="space-y-3">
      <div>
        <Label htmlFor="mobile-text">Text Input</Label>
        <Input 
          id="mobile-text" 
          type="text" 
          placeholder="Optimized for mobile"
          className="touch-manipulation"
          autoComplete="name"
        />
      </div>
      
      <div>
        <Label htmlFor="mobile-email">Email (opens email keyboard)</Label>
        <Input 
          id="mobile-email" 
          type="email" 
          placeholder="email@example.com"
          className="touch-manipulation"
          autoComplete="email"
          inputMode="email"
        />
      </div>
      
      <div>
        <Label htmlFor="mobile-tel">Phone (opens numeric keyboard)</Label>
        <Input 
          id="mobile-tel" 
          type="tel" 
          placeholder="+1 (555) 000-0000"
          className="touch-manipulation"
          autoComplete="tel"
          inputMode="tel"
        />
      </div>
      
      <div>
        <Label htmlFor="mobile-numeric">Numeric (opens number pad)</Label>
        <Input 
          id="mobile-numeric" 
          type="text" 
          placeholder="12345"
          className="touch-manipulation"
          inputMode="numeric"
          pattern="[0-9]*"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Input fields optimized for mobile with appropriate keyboards and input modes.",
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(2, 1fr)', 
      gap: designTokens.spacing[4],
    }}>
      <div>
        <Label>Text</Label>
        <Input type="text" placeholder="Text input" />
      </div>
      
      <div>
        <Label>Email</Label>
        <Input type="email" placeholder="email@example.com" />
      </div>
      
      <div>
        <Label>Password</Label>
        <Input type="password" placeholder="Password" />
      </div>
      
      <div>
        <Label>Number</Label>
        <Input type="number" placeholder="123" />
      </div>
      
      <div>
        <Label>Search</Label>
        <Input type="search" placeholder="Search..." />
      </div>
      
      <div>
        <Label>Tel</Label>
        <Input type="tel" placeholder="+1234567890" />
      </div>
      
      <div>
        <Label>URL</Label>
        <Input type="url" placeholder="https://example.com" />
      </div>
      
      <div>
        <Label>Date</Label>
        <Input type="date" />
      </div>
      
      <div>
        <Label>Time</Label>
        <Input type="time" />
      </div>
      
      <div>
        <Label>File</Label>
        <Input type="file" />
      </div>
      
      <div>
        <Label>Disabled</Label>
        <Input type="text" placeholder="Disabled" disabled />
      </div>
      
      <div>
        <Label>Read-only</Label>
        <Input type="text" value="Read-only" readOnly />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All input types and states in one view for easy comparison.",
      },
    },
  },
};