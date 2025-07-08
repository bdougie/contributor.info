import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type FeedSource = 'github' | 'database';

export function FeedSourceToggle({ className }: { className?: string }) {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();

  const handleSpamClick = () => {
    if (owner && repo) {
      navigate(`/${owner}/${repo}/feed/spam`);
    }
  };

  return (
    <TooltipProvider>
      <div className={className}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSpamClick}
              aria-label="Go to spam analysis page"
            >
              <Database className="h-4 w-4 mr-2" />
              Spam
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Advanced spam detection and analysis</p>
            <p className="text-xs text-muted-foreground">Requires authentication • Navigate to dedicated spam page</p>
          </TooltipContent>
        </Tooltip>
      </div>
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