import { useState, useEffect } from 'react';
import { Database, Github } from 'lucide-react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type FeedSource = 'github' | 'database';

interface FeedSourceToggleProps {
  value: FeedSource;
  onChange: (source: FeedSource) => void;
  className?: string;
}

export function FeedSourceToggle({ value, onChange, className }: FeedSourceToggleProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => newValue && onChange(newValue as FeedSource)}
        className={className}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="github" aria-label="Use GitHub API">
              <Github className="h-4 w-4 mr-2" />
              Live
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Fetch latest data directly from GitHub</p>
            <p className="text-xs text-muted-foreground">Real-time but no spam filtering</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="database" aria-label="Use cached database">
              <Database className="h-4 w-4 mr-2" />
              Spam
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Use cached data with spam detection</p>
            <p className="text-xs text-muted-foreground">May be slightly delayed but includes filtering</p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}

// Hook to persist feed source preference
export function useFeedSourcePreference(defaultSource: FeedSource = 'github') {
  const [source, setSource] = useState<FeedSource>(() => {
    const stored = localStorage.getItem('feed-source-preference');
    return (stored as FeedSource) || defaultSource;
  });

  useEffect(() => {
    localStorage.setItem('feed-source-preference', source);
  }, [source]);

  return [source, setSource] as const;
}