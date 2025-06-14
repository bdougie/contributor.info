import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';
import { Label } from './label';

const meta = {
  title: 'UI/Forms/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A textarea component with auto-resize capabilities.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the textarea',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
    },
    rows: {
      control: 'number',
      description: 'Number of visible text lines',
    },
    maxLength: {
      control: 'number',
      description: 'Maximum character length',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Type your message here.',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'This is a textarea with some initial content.',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'This textarea is disabled.',
    disabled: true,
  },
};

export const WithRows: Story = {
  args: {
    placeholder: 'This textarea has 5 rows.',
    rows: 5,
  },
};

export const WithMaxLength: Story = {
  args: {
    placeholder: 'Max 100 characters...',
    maxLength: 100,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="message">Your message</Label>
      <Textarea placeholder="Type your message here." id="message" />
    </div>
  ),
};

export const WithLabelAndDescription: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="bio">Bio</Label>
      <Textarea
        placeholder="Tell us a little bit about yourself"
        id="bio"
        rows={4}
      />
      <p className="text-sm text-muted-foreground">
        You can @mention other users and organizations.
      </p>
    </div>
  ),
};

export const FormExample: Story = {
  render: () => (
    <form className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea
          id="feedback"
          placeholder="What would you like to share with us?"
          rows={4}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="details">Additional details</Label>
        <Textarea
          id="details"
          placeholder="Please provide any additional context..."
          rows={3}
        />
      </div>
    </form>
  ),
};

export const WithCharacterCount: Story = {
  render: () => {
    const CharacterCountExample = () => {
      const [value, setValue] = React.useState('');
      const maxLength = 200;
      
      return (
        <div className="grid gap-2">
          <Label htmlFor="limited">Message</Label>
          <Textarea
            id="limited"
            placeholder="Type your message..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={maxLength}
          />
          <p className="text-sm text-muted-foreground text-right">
            {value.length}/{maxLength}
          </p>
        </div>
      );
    };
    return <CharacterCountExample />;
  },
};

// Import React for the controlled example
import * as React from 'react';