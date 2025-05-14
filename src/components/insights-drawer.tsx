import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRepoStats } from '@/hooks/use-repo-stats';
import { Markdown } from './markdown';

export function InsightsDrawer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<{ open?: string; merged?: string }>({});
  const { stats } = useRepoStats();

  const generateInsights = async (type: 'open' | 'merged') => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          pullRequests: stats.pullRequests,
          type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setInsights(prev => ({
        ...prev,
        [type]: data.insights
      }));
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg">
          <Lightbulb className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] h-full">
        <SheetHeader>
          <SheetTitle>Pull Request Insights</SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-full flex flex-col">
          <Tabs defaultValue="open" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="open" onClick={() => !insights.open && generateInsights('open')}>
                Open PRs
              </TabsTrigger>
              <TabsTrigger value="merged" onClick={() => !insights.merged && generateInsights('merged')}>
                Merged PRs
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[calc(100vh-12rem)] mt-4 rounded-md border p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <TabsContent value="open" className="mt-0">
                    {insights.open ? (
                      <Markdown>{insights.open}</Markdown>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        Click to generate insights about open pull requests
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="merged" className="mt-0">
                    {insights.merged ? (
                      <Markdown>{insights.merged}</Markdown>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        Click to generate insights about merged pull requests
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}