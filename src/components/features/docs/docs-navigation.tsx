import { useState, useEffect } from 'react';
import { ChevronRight, FileText, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DocsEntry {
  title: string;
  category: 'feature' | 'insight';
  anchor: string;
}

interface DocsNavigationProps {
  entries: DocsEntry[];
  activeSection?: string;
  onSectionSelect?: (section: string) => void;
  className?: string;
}

export function DocsNavigation({ 
  entries, 
  activeSection, 
  onSectionSelect,
  className 
}: DocsNavigationProps) {
  // Check if we're on mobile (screen width < 1024px) and default to closed on mobile
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // lg breakpoint
    }
    return true; // Default to open for SSR
  });
  const [currentActive, setCurrentActive] = useState(activeSection);

  useEffect(() => {
    if (activeSection !== currentActive) {
      setCurrentActive(activeSection);
    }
  }, [activeSection, currentActive]);

  // Handle window resize to adjust open state based on screen size
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsOpen(isLargeScreen);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSectionClick = (title: string, anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setCurrentActive(title);
      onSectionSelect?.(title);
    }
  };

  const getCategoryColor = (category: 'feature' | 'insight') => {
    return category === 'feature' 
      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      : 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
  };

  const getCategoryIcon = (category: 'feature' | 'insight') => {
    const IconComponent = category === 'feature' ? FileText : Book;
    return <IconComponent className="h-3 w-3" />;
  };

  // Group entries by category
  const featureEntries = entries.filter(entry => entry.category === 'feature');
  const insightEntries = entries.filter(entry => entry.category === 'insight');

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full lg:w-64 bg-card border rounded-lg p-4", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-0 h-auto font-semibold text-left"
          >
            <span>Documentation</span>
            <ChevronRight 
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen && "rotate-90"
              )} 
            />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-4">
          {featureEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Features
              </div>
              <div className="space-y-1 pl-2">
                {featureEntries.map((entry) => (
                  <Button
                    key={entry.title}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start px-2 py-1 h-auto text-left font-normal",
                      currentActive === entry.title && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSectionClick(entry.title, entry.anchor)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm">{entry.title}</span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getCategoryColor(entry.category))}
                      >
                        {getCategoryIcon(entry.category)}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {insightEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Book className="h-4 w-4" />
                Insights
              </div>
              <div className="space-y-1 pl-2">
                {insightEntries.map((entry) => (
                  <Button
                    key={entry.title}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start px-2 py-1 h-auto text-left font-normal",
                      currentActive === entry.title && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSectionClick(entry.title, entry.anchor)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm">{entry.title}</span>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getCategoryColor(entry.category))}
                      >
                        {getCategoryIcon(entry.category)}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}