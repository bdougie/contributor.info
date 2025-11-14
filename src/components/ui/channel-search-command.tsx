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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const selectedChannel = channels.find((ch) => ch.id === selectedChannelId);

  const handleSelect = (channelId: string) => {
    onChannelSelect(channelId);
    setOpen(false);
    setSearchValue('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Show currently selected channel */}
      {selectedChannel && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
          <span className="text-sm font-medium">Current channel:</span>
          <Badge variant="secondary" className="font-mono">
            #{selectedChannel.name}
          </Badge>
          {selectedChannel.is_private && (
            <span className="text-xs text-muted-foreground">(private)</span>
          )}
        </div>
      )}

      {/* Channel selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedChannel ? `#${selectedChannel.name}` : 'Select a channel...'}
            <span className="ml-2 text-muted-foreground">▼</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command
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
                      onSelect={() => handleSelect(channel.id)}
                      className={cn(
                        'flex items-center justify-between gap-2 cursor-pointer',
                        isSelected && 'bg-accent text-accent-foreground'
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
