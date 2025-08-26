import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Lock, Loader2, AlertCircle } from '@/components/ui/icon';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { toast } from 'sonner';

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
      console.log('Sending track request for: %s/%s', owner, repo);
      
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
        console.error('Failed to parse response: %s', responseText);
        throw new Error('Invalid response from server');
      }

      console.log('Track repository response: %o', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to track repository');
      }

      // Check if tracking was successful
      if (result.success) {
        console.log('Tracking initiated successfully, eventId: %s', result.eventId);
        
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
        const response = await fetch(`/api/repository-status?owner=${owner}&repo=${repo}`);
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
            This repository hasn't been tracked yet
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Call-to-Action section */}
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Start tracking this repository</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Unlock contributor analytics, PR visualizations, and community health metrics. 
            We'll analyze the repository and provide insights into contribution patterns.
          </p>
          
          {/* Primary tracking button - more prominent placement */}
          <div className="flex justify-center mb-3">
            {!isLoggedIn ? (
              <Button 
                onClick={handleLogin}
                size="lg"
                variant="default"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Lock className="mr-2 h-4 w-4" />
                Login to Track Repository
              </Button>
            ) : (
              <Button 
                onClick={handleTrackRepository}
                disabled={isTracking}
                size="lg"
                variant="default"
                className="bg-orange-500 hover:bg-orange-600 text-white disabled:bg-orange-300"
              >
                {isTracking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up tracking...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Track This Repository
                  </>
                )}
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Setup takes 1-2 minutes • Data refreshes automatically
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {error.includes('longer than expected') && (
              <div className="flex gap-2 justify-center">
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

      </CardContent>
    </Card>
  );
}