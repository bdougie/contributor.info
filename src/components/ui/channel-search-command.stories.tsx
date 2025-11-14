import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ChannelSearchCommand } from './channel-search-command';
import type { SlackChannel } from '@/types/workspace';

const meta = {
  title: 'UI/ChannelSearchCommand',
  component: ChannelSearchCommand,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChannelSearchCommand>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockChannels: SlackChannel[] = [
  { id: '1', name: 'general', is_private: false },
  { id: '2', name: 'engineering', is_private: false },
  { id: '3', name: 'design', is_private: false },
  { id: '4', name: 'product', is_private: false },
  { id: '5', name: 'random', is_private: false },
  { id: '6', name: 'alerts', is_private: false },
  { id: '7', name: 'security', is_private: true },
  { id: '8', name: 'leadership', is_private: true },
  { id: '9', name: 'customer-success', is_private: false },
  { id: '10', name: 'announcements', is_private: false },
];

export const Default: Story = {
  args: {
    channels: mockChannels,
    onChannelSelect: (channelId: string) => {
      console.log('Selected channel:', channelId);
    },
    placeholder: 'Search channels...',
    emptyMessage: 'No channels found',
  },
};

export const WithSelection: Story = {
  args: {
    channels: mockChannels,
    onChannelSelect: (channelId: string) => {
      console.log('Selected channel:', channelId);
    },
    selectedChannelId: '2',
    placeholder: 'Search channels...',
    emptyMessage: 'No channels found',
  },
};

export const PrivateChannelSelected: Story = {
  args: {
    channels: mockChannels,
    onChannelSelect: (channelId: string) => {
      console.log('Selected channel:', channelId);
    },
    selectedChannelId: '7',
    placeholder: 'Search channels...',
    emptyMessage: 'No channels found',
  },
};

export const EmptyChannels: Story = {
  args: {
    channels: [],
    onChannelSelect: (channelId: string) => {
      console.log('Selected channel:', channelId);
    },
    placeholder: 'Search channels...',
    emptyMessage: 'No channels available',
  },
};

export const Disabled: Story = {
  args: {
    channels: mockChannels,
    onChannelSelect: (channelId: string) => {
      console.log('Selected channel:', channelId);
    },
    disabled: true,
    selectedChannelId: '2',
    placeholder: 'Search channels...',
    emptyMessage: 'No channels found',
  },
};

export const Interactive = () => {
  const [selectedId, setSelectedId] = useState<string | null>('2');

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Click the button to open the channel selector. Selection automatically closes the popover.
      </div>
      <ChannelSearchCommand
        channels={mockChannels}
        onChannelSelect={(channelId: string) => {
          console.log('Selected channel:', channelId);
          setSelectedId(channelId);
        }}
        selectedChannelId={selectedId}
        placeholder="Search channels..."
        emptyMessage="No channels found"
      />
    </div>
  );
};
