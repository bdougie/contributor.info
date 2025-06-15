import type { Meta, StoryObj } from '@storybook/react';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

const meta = {
  title: 'UI/Forms/RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A radio group component built on top of Radix UI Radio Group.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the radio group is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the radio group is required',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'The orientation of the radio group',
    },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="option-one">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-one" id="option-one" />
        <Label htmlFor="option-one">Option One</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-two" id="option-two" />
        <Label htmlFor="option-two">Option Two</Label>
      </div>
    </RadioGroup>
  ),
};

export const WithDefaultValue: Story = {
  render: () => (
    <RadioGroup defaultValue="comfortable">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="default" id="r1" />
        <Label htmlFor="r1">Default</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="comfortable" id="r2" />
        <Label htmlFor="r2">Comfortable</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="compact" id="r3" />
        <Label htmlFor="r3">Compact</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup disabled defaultValue="option-two">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-one" id="disabled-1" />
        <Label htmlFor="disabled-1">Option One</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-two" id="disabled-2" />
        <Label htmlFor="disabled-2">Option Two</Label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <RadioGroup defaultValue="card">
      <div className="grid gap-4">
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="card" id="card" className="mt-1" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="card" className="font-medium">
              Card Payment
            </Label>
            <p className="text-sm text-muted-foreground">
              Pay with credit or debit card.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="paypal" id="paypal" className="mt-1" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="paypal" className="font-medium">
              PayPal
            </Label>
            <p className="text-sm text-muted-foreground">
              Pay with your PayPal account.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <RadioGroupItem value="apple" id="apple" className="mt-1" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="apple" className="font-medium">
              Apple Pay
            </Label>
            <p className="text-sm text-muted-foreground">
              Pay with Apple Pay.
            </p>
          </div>
        </div>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="option-one" orientation="horizontal" className="flex gap-4">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-one" id="h1" />
        <Label htmlFor="h1">Option One</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-two" id="h2" />
        <Label htmlFor="h2">Option Two</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-three" id="h3" />
        <Label htmlFor="h3">Option Three</Label>
      </div>
    </RadioGroup>
  ),
};

export const FormExample: Story = {
  render: () => (
    <form className="w-full max-w-md space-y-6">
      <div className="space-y-3">
        <Label className="text-base">Notify me about...</Label>
        <RadioGroup defaultValue="all">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="font-normal">
              All new messages
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mentions" id="mentions" />
            <Label htmlFor="mentions" className="font-normal">
              Direct messages and mentions
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="none" />
            <Label htmlFor="none" className="font-normal">
              Nothing
            </Label>
          </div>
        </RadioGroup>
      </div>
    </form>
  ),
};