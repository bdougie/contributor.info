import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Lock, Loader2, AlertCircle } from '@/components/ui/icon';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { toast } from 'sonner';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface RepositoryTrackingCardProps {
  owner: string;
  repo: string;
  onTrackingComplete?: () => void;
  className?: string;
}

export function RepositoryTrackingCard({
  owner,
  repo,
  onTrackingComplete,
  className = ''
}: RepositoryTrackingCardProps) {
  const { isLoggedIn, login } = useGitHubAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate mock scatter plot data
  const mockData = useMemo(() => {
    const data = [];
    const contributors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    
    // Generate 30 mock PR data points
    for (let i = 0; i < 30; i++) {
      data.push({
        x: Math.floor(Math.random() * 30), // Days ago
        y: Math.floor(Math.random() * 200) + 10, // Lines changed
        contributor: contributors[Math.floor(Math.random() * contributors.length)],
        opacity: 0.3 + Math.random() * 0.4 // Varying opacity for blur effect
      });
    }
    
    return data.sort((a, b) => a.x - b.x);
  }, []);

  const handleLogin = async () => {
    // Store the repository path so we can auto-track after login
    localStorage.setItem('pendingTrackRepo', `${owner}/${repo}`);
    localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
    await login();
  };

  const handleTrackRepository = async () => {
    // Prevent duplicate tracking requests
    if (isTracking) {
      return;
    }
    
    // Validate props before sending
    if (!owner || !repo) {
      console.error('Missing owner or repo:', { owner, repo });
      setError('Invalid repository information');
      toast.error('Invalid repository', {
        description: 'Repository information is missing',
        duration: 6000
      });
      return;
    }
    
    setIsTracking(true);
    setError(null);

    try {
      console.log('Sending track request for:', { owner, repo });
      
      // Call the new tracking API endpoint
      const response = await fetch('/api/track-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo })
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }

      console.log('Track repository response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to track repository');
      }

      // Check if tracking was successful
      if (result.success) {
        console.log('Tracking initiated successfully, eventId:', result.eventId);
        
        // Show success message
        toast.success('Repository tracking initiated!', {
          description: 'Data will be available in 1-2 minutes. The page will refresh automatically.',
          duration: 8000
        });
      } else {
        throw new Error(result.message || 'Tracking failed');
      }

      // Start polling for completion
      startPollingForData();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to track repository';
      setError(errorMessage);
      toast.error('Tracking failed', {
        description: errorMessage,
        duration: 6000
      });
    } finally {
      setIsTracking(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const startPollingForData = () => {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 2 minutes

    // Clear any existing interval before starting a new one
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      pollCount++;

      try {
        // Check if repository now has data
        const response = await fetch(`/.netlify/functions/api-repository-status?owner=${owner}&repo=${repo}`);
        const data = await response.json();

        if (data.hasData) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          toast.success('Repository data is ready!', {
            description: 'Refreshing page...',
            duration: 2000
          });
          
          // Trigger callback or refresh
          if (onTrackingComplete) {
            onTrackingComplete();
          } else {
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        }

        if (pollCount >= maxPolls) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          toast.info('Data sync is taking longer than expected', {
            description: 'Please refresh the page in a few minutes.',
            duration: 10000
          });
        }
      } catch (err) {
        // Silently continue polling
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{owner}/{repo}</h2>
          <p className="text-sm text-muted-foreground">
            Track this repository to get analysis of recent pull requests
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mock scatter plot with blur effect */}
        <div className="relative h-[200px] w-full">
          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-[1px] bg-background/10 z-10 rounded-lg" />
          
          {/* Mock chart */}
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="x" 
                domain={[0, 30]}
                ticks={[0, 7, 14, 21, 30]}
                tickFormatter={(value) => `${value}d`}
                className="text-xs"
                stroke="currentColor"
                opacity={0.5}
              />
              <YAxis 
                dataKey="y"
                domain={[0, 250]}
                className="text-xs"
                stroke="currentColor"
                opacity={0.5}
                label={{ value: 'Lines', angle: -90, position: 'insideLeft', className: 'text-xs' }}
              />
              <Tooltip 
                content={() => null} // Hide tooltip for mock data
              />
              <Scatter 
                data={mockData} 
                fill="#3b82f6"
              >
                {mockData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill="#3b82f6" 
                    fillOpacity={entry.opacity}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {error && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {error.includes('longer than expected') && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    handleTrackRepository();
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tracking prompt box similar to "Need complete data faster?" */}
        <div className="p-4 rounded-lg border bg-black dark:bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-white dark:text-black">
                Start tracking <strong>{owner}/{repo}</strong>
              </p>
              <p className="text-xs text-white/70 dark:text-black/70 mt-1">
                Get contributor analytics, PR visualizations, and community health metrics. 
                We'll analyze the repository and provide insights into contribution patterns.
              </p>
              <p className="text-xs text-white/60 dark:text-black/60 mt-2">
                Takes 1-2 minutes
              </p>
            </div>
            <div className="flex flex-col items-center sm:items-end">
              {!isLoggedIn ? (
                <Button 
                  onClick={handleLogin}
                  variant="default"
                  className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Login to Track
                </Button>
              ) : (
                <Button 
                  onClick={handleTrackRepository}
                  disabled={isTracking}
                  variant="default"
                  className="bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300 w-full sm:w-auto"
                >
                  {isTracking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tracking...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Track This Repo
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}