/**
 * ChannelSearchCommand Component
 * A live-updating search list for Slack channels using shadcn Command component
 * Similar to agent search UI with real-time filtering
 */

import { useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { SlackChannel } from '@/types/workspace';

interface ChannelSearchCommandProps {
  channels: SlackChannel[];
  onChannelSelect: (channelId: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  selectedChannelId?: string | null;
  disabled?: boolean;
}

export function ChannelSearchCommand({
  channels,
  onChannelSelect,
  placeholder = 'Search channels...',
  emptyMessage = 'No channels found',
  className,
  selectedChannelId,
  disabled = false,
}: ChannelSearchCommandProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <Command
      className={cn('rounded-lg border shadow-md', className)}
      filter={(value, search) => {
        // Custom filter logic to search channel names
        const channelName = channels.find((ch) => ch.id === value)?.name || '';
        if (channelName.toLowerCase().includes(search.toLowerCase())) {
          return 1;
        }
        return 0;
      }}
    >
      <CommandInput
        placeholder={placeholder}
        value={searchValue}
        onValueChange={setSearchValue}
        disabled={disabled}
      />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {channels.map((channel) => {
            const isSelected = selectedChannelId === channel.id;
            return (
              <CommandItem
                key={channel.id}
                value={channel.id}
                onSelect={() => {
                  if (!disabled) {
                    onChannelSelect(channel.id);
                  }
                }}
                className={cn(
                  'flex items-center justify-between gap-2 cursor-pointer',
                  isSelected && 'bg-accent text-accent-foreground',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{channel.name}</span>
                  {channel.is_private && (
                    <span className="text-xs text-muted-foreground">(private)</span>
                  )}
                </div>
                {isSelected && <span className="text-xs">✓</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
