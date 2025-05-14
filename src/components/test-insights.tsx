import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TestInsights() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<any>(null);

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
    setRequestDetails(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights`;
      
      // Log request details
      const requestInfo = {
        url: apiUrl,
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: data
      };
      console.log('Request details:', requestInfo);
      setRequestDetails(requestInfo);

      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Log response details
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('Response data:', result);
      
      if (!response.ok) {
        // Handle specific error cases
        let errorMessage = result.error || `HTTP error! status: ${response.status}`;
        if (response.status === 401) {
          errorMessage = 'Authentication error: Please check your API keys in the environment settings.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded: Please try again later.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error: The service is currently unavailable. Please try again later.';
        }
        throw new Error(errorMessage);
      }
      
      setResponse(result);
    } catch (err) {
      let errorMessage: string;
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out after 30 seconds. Please try again.';
      } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
      } else {
        errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      }
      
      setError(`${errorMessage}\n\nPlease check the console for more details.`);
      console.error('Test function error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto my-8">
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
            <p className="text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {requestDetails && (
          <div className="p-4 bg-muted rounded-md">
            <p className="font-semibold">Request Details:</p>
            <pre className="text-sm mt-2 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(requestDetails, null, 2)}
            </pre>
          </div>
        )}

        {response && (
          <div className="p-4 bg-muted rounded-md">
            <p className="font-semibold">Response:</p>
            <pre className="text-sm mt-2 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}