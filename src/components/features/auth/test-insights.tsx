import { useState } from 'react';
import { Loader2 } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analyzePullRequests } from '@/lib/insights/pullRequests';
import { RepoInsightsContainer } from '@/components/insights/RepoInsightsContainer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TestInsights() {
  // State for the legacy function testing
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<unknown>(null);

  // State for the new implementation testing
  const [owner, setOwner] = useState('facebook');
  const [repo, setRepo] = useState('react');
  const [localLoading, setLocalLoading] = useState(false);
  const [localResponse, setLocalResponse] = useState<unknown>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sample PR data for testing
  const testData = {
    pullRequests: [
      {
        id: 1,
        title: 'Test PR 1',
        state: 'closed',
        created_at: new Date().toISOString(),
        merged_at: new Date().toISOString(),
        number: 1,
        html_url: 'https://github.com/test/repo/pull/1',
        user: { login: 'testuser1' },
      },
      {
        id: 2,
        title: 'Test PR 2',
        state: 'open',
        created_at: new Date().toISOString(),
        merged_at: null,
        number: 2,
        html_url: 'https://github.com/test/repo/pull/2',
        user: { login: 'testuser2' },
      },
    ],
  };

  const testEmptyData = {
    pullRequests: [],
  };

  // Legacy Supabase function test
  const testSupabaseFunction = async (data: Record<string, unknown>) => {
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
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: data,
      };
      console.log('Request details:', requestInfo);
      setRequestDetails(requestInfo);

      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
          errorMessage =
            'Authentication error: Please check your API keys in the environment settings.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded: Please try again later.';
        } else if (response.status >= 500) {
          errorMessage =
            'Server error: The service is currently unavailable. Please try again later.';
        }
        throw new Error(errorMessage);
      }

      setResponse(result);
    } catch (err) {
      let errorMessage: string;

      if (err instanceof Error && err.name === 'AbortError') {
        errorMessage = 'Request timed out after 30 seconds. Please try again.';
      } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage =
          'Network error: Unable to connect to the server. Please check your internet connection and try again.';
      } else {
        errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      }

      setError(`${errorMessage}\n\nPlease check the console for more details.`);
      console.error('Test function error:', err);
    } finally {
      setLoading(false);
    }
  };

  // New local implementation test
  const testLocalImplementation = async () => {
    if (!owner || !repo) {
      setLocalError('Please enter both owner and repository name');
      return;
    }

    setLocalLoading(true);
    setLocalError(null);
    setLocalResponse(null);

    try {
      console.log('Testing local implementation with: %s/%s', owner, repo);
      const result = await analyzePullRequests(owner, repo);
      console.log('Local analysis result:', result);
      setLocalResponse(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setLocalError(errorMessage);
      console.error('Local analysis error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  const testWithLocalData = async () => {
    setLocalLoading(true);
    setLocalError(null);
    setLocalResponse(null);

    try {
      // Simulate local analysis with the test data
      const result = {
        totalPRs: testData.pullRequests.length,
        averageTimeToMerge: 24, // Mock 24 hours
        prMergeTimesByAuthor: {
          testuser1: [24],
        },
        prsByAuthor: {
          testuser1: 1,
          testuser2: 1,
        },
      };

      setLocalResponse(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setLocalError(errorMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto my-8">
      <CardHeader>
        <CardTitle>Test Insights Implementation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="new">
          <TabsList className="mb-4">
            <TabsTrigger value="new">New Local Implementation</TabsTrigger>
            <TabsTrigger value="legacy">Legacy Supabase Function</TabsTrigger>
            <TabsTrigger value="component">Component Preview</TabsTrigger>
          </TabsList>

          {/* New Local Implementation Tab */}
          <TabsContent value="new" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Repository Owner</Label>
                <Input
                  id="owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g., facebook"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo">Repository Name</Label>
                <Input
                  id="repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="e.g., react"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={testLocalImplementation} disabled={localLoading}>
                Analyze Repository
              </Button>
              <Button onClick={testWithLocalData} disabled={localLoading} variant="outline">
                Test with Sample Data
              </Button>
            </div>

            {localLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {localError && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                <p className="font-semibold">Error:</p>
                <p className="text-sm whitespace-pre-wrap">{localError}</p>
              </div>
            )}

            {localResponse && (
              <div className="p-4 bg-muted rounded-md">
                <p className="font-semibold">Local Analysis Result:</p>
                <pre className="text-sm mt-2 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(localResponse, null, 2)}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* Legacy Supabase Function Tab */}
          <TabsContent value="legacy" className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={() => testSupabaseFunction(testData)} disabled={loading}>
                Test with Sample Data
              </Button>
              <Button
                onClick={() => testSupabaseFunction(testEmptyData)}
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
          </TabsContent>

          {/* Component Preview Tab */}
          <TabsContent value="component" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="component-owner">Repository Owner</Label>
                <Input
                  id="component-owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g., facebook"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="component-repo">Repository Name</Label>
                <Input
                  id="component-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="e.g., react"
                />
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4">
              <RepoInsightsContainer owner={owner} repo={repo} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
