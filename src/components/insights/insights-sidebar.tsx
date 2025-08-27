import { useState, useEffect, lazy, Suspense } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Heart,
  Sparkles,
  FileText,
  HelpCircle,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams } from 'react-router-dom';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { getCriticalPrCount } from '@/lib/insights/pr-attention';

// Lazy load section components - only loaded when user clicks on them
const NeedsAttention = lazy(() =>
  import('./sections/needs-attention').then((m) => ({ default: m.NeedsAttention }))
);
const InsightsHealth = lazy(() =>
  import('./sections/repository-health-insights').then((m) => ({ default: m.InsightsHealth }))
);
const Recommendations = lazy(() =>
  import('./sections/recommendations').then((m) => ({ default: m.Recommendations }))
);
const RepositorySummary = lazy(() =>
  import('./sections/repository-summary').then((m) => ({ default: m.RepositorySummary }))
);
const ProjectFAQ = lazy(() =>
  import('./sections/project-faq').then((m) => ({ default: m.ProjectFAQ }))
);

// Loading skeleton for lazy-loaded sections
const InsightsSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-20 w-full" />
  </div>
);

interface InsightsSidebarProps {
  className?: string;
}

export function InsightsSidebar({ className }: InsightsSidebarProps) {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>('summary');
  const [criticalCount, setCriticalCount] = useState(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load critical PR count
  useEffect(() => {
    if (owner && repo) {
      getCriticalPrCount(owner, repo)
        .then(setCriticalCount)
        .catch(() => setCriticalCount(0));
    }
  }, [owner, repo, timeRange]);

  const sections = [
    {
      id: 'summary',
      title: 'Repository Overview',
      icon: FileText,
      color: 'text-blue-500',
      count: null,
    },
    {
      id: 'attention',
      title: 'Needs Attention',
      icon: AlertCircle,
      color: 'text-red-500',
      count: criticalCount,
    },
    {
      id: 'health',
      title: 'Repository Health',
      icon: Heart,
      color: 'text-pink-500',
      count: null,
    },
    {
      id: 'recommendations',
      title: 'Recommendations',
      icon: Sparkles,
      color: 'text-purple-500',
      count: 5,
    },
    {
      id: 'faq',
      title: 'FAQ',
      icon: HelpCircle,
      color: 'text-green-500',
      count: null,
    },
  ];

  if (!owner || !repo) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex fixed right-0 top-0 h-full border-l transition-all duration-300 z-40 dark',
          'bg-slate-900 text-slate-100 border-slate-700',
          isCollapsed ? 'w-16' : 'w-[420px]',
          className
        )}
      >
        <div className="flex flex-col w-full h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            {!isCollapsed && <h2 className="text-lg font-semibold">Insights</h2>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className={cn('p-4', isCollapsed && 'p-2')}>
              {isCollapsed ? (
                // Collapsed view - icon buttons
                <div className="space-y-4">
                  {sections.map((section) => (
                    <Button
                      key={section.id}
                      variant="ghost"
                      size="icon"
                      className="w-full relative"
                      onClick={() => {
                        setIsCollapsed(false);
                        setActiveSection(section.id);
                      }}
                      aria-label={section.title}
                    >
                      <section.icon className={cn('h-5 w-5', section.color)} />
                      {section.count !== null && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                          {section.count}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              ) : (
                // Expanded view - full sections
                <div className="space-y-6">
                  {sections.map((section, index) => (
                    <div key={section.id}>
                      {index > 0 && <Separator className="mb-6 bg-slate-700" />}
                      <div
                        className="cursor-pointer"
                        onClick={() =>
                          setActiveSection(activeSection === section.id ? null : section.id)
                        }
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <section.icon className={cn('h-5 w-5', section.color)} />
                            <h3 className="font-medium">{section.title}</h3>
                          </div>
                          {section.count !== null && (
                            <span className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded-full">
                              {section.count}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Section content - lazy loaded on demand */}
                      {activeSection === section.id && owner && repo && (
                        <div className="mt-3 w-full overflow-hidden">
                          <Suspense fallback={<InsightsSkeleton />}>
                            {section.id === 'summary' && (
                              <RepositorySummary owner={owner} repo={repo} timeRange={timeRange} />
                            )}
                            {section.id === 'attention' && (
                              <NeedsAttention owner={owner} repo={repo} timeRange={timeRange} />
                            )}
                            {section.id === 'health' && (
                              <InsightsHealth owner={owner} repo={repo} timeRange={timeRange} />
                            )}
                            {section.id === 'recommendations' && (
                              <Recommendations owner={owner} repo={repo} timeRange={timeRange} />
                            )}
                            {section.id === 'faq' && (
                              <ProjectFAQ owner={owner} repo={repo} timeRange={timeRange} />
                            )}
                          </Suspense>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
            >
              <Sparkles className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[80vh] dark bg-slate-900 text-slate-100 border-slate-700"
          >
            <SheetHeader>
              <SheetTitle>Insights</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)] mt-4">
              <div className="space-y-6 pb-6">
                {sections.map((section, index) => (
                  <div key={section.id}>
                    {index > 0 && <Separator className="mb-6 bg-slate-700" />}
                    <div
                      className="cursor-pointer"
                      onClick={() =>
                        setActiveSection(activeSection === section.id ? null : section.id)
                      }
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <section.icon className={cn('h-5 w-5', section.color)} />
                          <h3 className="font-medium">{section.title}</h3>
                        </div>
                        {section.count !== null && (
                          <span className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded-full">
                            {section.count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section content */}
                    {activeSection === section.id && owner && repo && (
                      <div className="mt-3 w-full overflow-hidden">
                        {section.id === 'summary' && (
                          <RepositorySummary owner={owner} repo={repo} timeRange={timeRange} />
                        )}
                        {section.id === 'attention' && (
                          <NeedsAttention owner={owner} repo={repo} timeRange={timeRange} />
                        )}
                        {section.id === 'health' && (
                          <InsightsHealth owner={owner} repo={repo} timeRange={timeRange} />
                        )}
                        {section.id === 'recommendations' && (
                          <Recommendations owner={owner} repo={repo} timeRange={timeRange} />
                        )}
                        {section.id === 'faq' && (
                          <ProjectFAQ owner={owner} repo={repo} timeRange={timeRange} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
