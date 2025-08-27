import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const meta = {
  title: 'Tests/Accessibility',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Accessibility-focused interaction tests for UI components.',
      },
    },
  },
  tags: ['skip-test'], // TODO: Fix test
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
  tags: ['accessibility', 'screen-reader'],
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
  tags: ['accessibility', 'visual'],
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
};
