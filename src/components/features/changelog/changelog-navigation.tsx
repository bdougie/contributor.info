import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ChangelogEntry {
  version: string;
  date: string;
  anchor: string;
}

interface ChangelogNavigationProps {
  entries: ChangelogEntry[];
  activeVersion?: string;
  onVersionSelect?: (version: string) => void;
  className?: string;
}

export function ChangelogNavigation({ 
  entries, 
  activeVersion, 
  onVersionSelect,
  className 
}: ChangelogNavigationProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentActive, setCurrentActive] = useState(activeVersion);

  useEffect(() => {
    if (activeVersion !== currentActive) {
      setCurrentActive(activeVersion);
    }
  }, [activeVersion, currentActive]);

  const handleVersionClick = (version: string, anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setCurrentActive(version);
      onVersionSelect?.(version);
    }
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-64 bg-card border rounded-lg p-4", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-0 h-auto font-semibold text-left"
          >
            <span>Version History</span>
            <ChevronRight 
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen && "rotate-90"
              )} 
            />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-1">
          {entries.map((entry) => (
            <Button
              key={entry.version}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start px-2 py-1 h-auto text-left font-normal",
                currentActive === entry.version && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleVersionClick(entry.version, entry.anchor)}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">v{entry.version}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </Button>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}