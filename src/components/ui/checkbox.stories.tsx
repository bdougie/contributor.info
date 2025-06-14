import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './checkbox';
import { Label } from './label';

const meta = {
  title: 'UI/Forms/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A checkbox component built on top of Radix UI Checkbox.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'The controlled checked state of the checkbox',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the checkbox is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the checkbox is required',
    },
    name: {
      control: 'text',
      description: 'The name of the checkbox for form submission',
    },
    value: {
      control: 'text',
      description: 'The value of the checkbox for form submission',
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Accept terms and conditions
      </Label>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="items-top flex space-x-2">
      <Checkbox id="terms2" />
      <div className="grid gap-1.5 leading-none">
        <Label
          htmlFor="terms2"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Accept terms and conditions
        </Label>
        <p className="text-sm text-muted-foreground">
          You agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => {
    const IndeterminateExample = () => {
      return (
        <Checkbox 
          checked="indeterminate"
          aria-label="Select all"
        />
      );
    };
    return <IndeterminateExample />;
  },
};

export const FormExample: Story = {
  render: () => (
    <form className="space-y-4">
      <div className="space-y-2">
        <Label>Notification Preferences</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="marketing" name="notifications" value="marketing" />
            <Label htmlFor="marketing" className="text-sm font-normal">
              Marketing emails
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="security" name="notifications" value="security" defaultChecked />
            <Label htmlFor="security" className="text-sm font-normal">
              Security alerts
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="updates" name="notifications" value="updates" />
            <Label htmlFor="updates" className="text-sm font-normal">
              Product updates
            </Label>
          </div>
        </div>
      </div>
    </form>
  ),
};