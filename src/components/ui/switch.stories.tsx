import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from './switch';
import { Label } from './label';

const meta = {
  title: 'UI/Forms/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A toggle switch component built on top of Radix UI Switch.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'The controlled checked state of the switch',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the switch is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the switch is required',
    },
    name: {
      control: 'text',
      description: 'The name of the switch for form submission',
    },
    value: {
      control: 'text',
      description: 'The value of the switch for form submission',
    },
  },
} satisfies Meta<typeof Switch>;

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
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-center justify-between space-x-4">
      <div className="space-y-0.5">
        <Label htmlFor="marketing-emails" className="text-base">
          Marketing emails
        </Label>
        <p className="text-sm text-muted-foreground">
          Receive emails about new products, features, and more.
        </p>
      </div>
      <Switch id="marketing-emails" />
    </div>
  ),
};

export const FormExample: Story = {
  render: () => (
    <form className="w-full max-w-sm space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-medium">Email Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="marketing" className="flex flex-col space-y-1">
              <span>Marketing emails</span>
              <span className="font-normal text-muted-foreground text-sm">
                Receive emails about new products and features.
              </span>
            </Label>
            <Switch id="marketing" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="security" className="flex flex-col space-y-1">
              <span>Security alerts</span>
              <span className="font-normal text-muted-foreground text-sm">
                Receive alerts about your account security.
              </span>
            </Label>
            <Switch id="security" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="updates" className="flex flex-col space-y-1">
              <span>Product updates</span>
              <span className="font-normal text-muted-foreground text-sm">
                Receive updates about product changes.
              </span>
            </Label>
            <Switch id="updates" />
          </div>
        </div>
      </div>
    </form>
  ),
};

export const Controlled: Story = {
  render: () => {
    const ControlledExample = () => {
      const [checked, setChecked] = React.useState(false);
      
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch 
              id="controlled" 
              checked={checked} 
              onCheckedChange={setChecked}
            />
            <Label htmlFor="controlled">
              {checked ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            The switch is {checked ? 'on' : 'off'}.
          </p>
        </div>
      );
    };
    return <ControlledExample />;
  },
};

// Import React for the controlled example
import * as React from 'react';