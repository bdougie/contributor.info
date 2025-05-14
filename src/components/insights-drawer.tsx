import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare } from 'lucide-react';
import { useContext } from 'react';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import ReactMarkdown from 'react-markdown';

export function InsightsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useContext(RepoStatsContext);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pullRequests: stats.pullRequests,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
      console.error('Error generating insights:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg"
          onClick={() => {
            setIsOpen(true);
            if (!insights && !loading) {
              generateInsights();
            }
          }}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] h-full">
        <SheetHeader>
          <SheetTitle>Pull Request Insights</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-6 pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive space-y-2">
              <p>Error: {error}</p>
              <Button 
                variant="outline" 
                onClick={generateInsights}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : insights ? (
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-muted-foreground">
              No insights available. Click generate to analyze pull requests.
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}