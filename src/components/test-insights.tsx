import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TestInsights() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Sample PR data for testing
  const testData = {
    pullRequests: [
      {
        id: 1,
        title: "Test PR 1",
        state: "closed",
        created_at: new Date().toISOString(),
        merged_at: new Date().toISOString(),
        number: 1,
        html_url: "https://github.com/test/repo/pull/1"
      },
      {
        id: 2,
        title: "Test PR 2",
        state: "open",
        created_at: new Date().toISOString(),
        merged_at: null,
        number: 2,
        html_url: "https://github.com/test/repo/pull/2"
      }
    ]
  };

  const testEmptyData = {
    pullRequests: []
  };

  const testFunction = async (data: any) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Test function error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle>Test Insights Function</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button 
            onClick={() => testFunction(testData)}
            disabled={loading}
          >
            Test with Sample Data
          </Button>
          <Button 
            onClick={() => testFunction(testEmptyData)}
            disabled={loading}
            variant="outline"
          >
            Test with Empty Data
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {response && (
          <div className="p-4 bg-muted rounded-md">
            <p className="font-semibold">Response:</p>
            <pre className="text-sm mt-2 whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}