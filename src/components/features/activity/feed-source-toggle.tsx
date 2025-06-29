import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database, GitBranch } from 'lucide-react';
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
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();

  const handleSpamClick = () => {
    if (owner && repo) {
      navigate(`/${owner}/${repo}/feed/spam`);
    }
  };

  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue === 'database') {
            handleSpamClick();
          } else if (newValue) {
            onChange(newValue as FeedSource);
          }
        }}
        className={className}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="github" aria-label="Use GitHub API">
              <GitBranch className="h-4 w-4 mr-2" />
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
            <ToggleGroupItem value="database" aria-label="Go to spam analysis page">
              <Database className="h-4 w-4 mr-2" />
              Spam
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Advanced spam detection and analysis</p>
            <p className="text-xs text-muted-foreground">Requires authentication • Navigate to dedicated spam page</p>
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