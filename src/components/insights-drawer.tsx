import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { useContext } from 'react';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import ReactMarkdown from 'react-markdown';

export function InsightsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useContext(RepoStatsContext);

  // Check if we have PRs to analyze
  const hasPullRequests = stats.pullRequests && stats.pullRequests.length > 0;

  const generateInsights = async () => {
    if (!hasPullRequests) {
      setError('No pull requests available for analysis');
      return;
    }

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
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setInsights(data.insights);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate insights';
      setError(errorMessage);
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
          disabled={!hasPullRequests || loading}
          onClick={() => {
            setIsOpen(true);
            if (!insights && !loading && hasPullRequests) {
              generateInsights();
            }
          }}
          title={!hasPullRequests ? "No pull requests available for analysis" : "Generate insights"}
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
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Error generating insights</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              {hasPullRequests && (
                <Button 
                  variant="outline" 
                  onClick={generateInsights}
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
            </div>
          ) : insights ? (
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {hasPullRequests ? (
                "No insights available. Click generate to analyze pull requests."
              ) : (
                "No pull requests available to analyze. Pull requests are needed to generate insights."
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}