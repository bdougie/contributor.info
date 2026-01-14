import type { Meta, StoryObj } from '@storybook/react';
import { TourTriggerButton } from './TourTriggerButton';
import { TourProvider } from '@/lib/onboarding-tour';

const meta: Meta<typeof TourTriggerButton> = {
  title: 'Features/Onboarding/TourTriggerButton',
  component: TourTriggerButton,
  decorators: [
    (Story) => (
      <TourProvider autoStart={false}>
        <div className="p-4">
          <Story />
        </div>
      </TourProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'ghost', 'outline', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    showLabel: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TourTriggerButton>;

export const Default: Story = {
  args: {
    variant: 'ghost',
    size: 'sm',
    showLabel: true,
  },
};

export const WithoutLabel: Story = {
  args: {
    variant: 'ghost',
    size: 'icon',
    showLabel: false,
  },
};

export const OutlineVariant: Story = {
  args: {
    variant: 'outline',
    size: 'default',
    showLabel: true,
  },
};

export const DefaultVariant: Story = {
  args: {
    variant: 'default',
    size: 'default',
    showLabel: true,
  },
};

export const Small: Story = {
  args: {
    variant: 'outline',
    size: 'sm',
    showLabel: true,
  },
};

export const Large: Story = {
  args: {
    variant: 'outline',
    size: 'lg',
    showLabel: true,
  },
};
