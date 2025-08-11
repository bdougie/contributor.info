import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, Lock, Loader2, AlertCircle } from '@/components/ui/icon';
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

  const handleLogin = async () => {
    // Store the repository path so we can auto-track after login
    localStorage.setItem('pendingTrackRepo', `${owner}/${repo}`);
    localStorage.setItem('redirectAfterLogin', `/${owner}/${repo}`);
    await login();
  };

  const handleTrackRepository = async () => {
    setIsTracking(true);
    setError(null);

    try {
      // Call the new tracking API endpoint
      const response = await fetch('/api/track-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to track repository');
      }

      // Show success message
      toast.success('Repository tracking initiated!', {
        description: 'Data will be available in 1-2 minutes. The page will refresh automatically.',
        duration: 8000
      });

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

  const startPollingForData = () => {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 2 minutes

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        // Check if repository now has data
        const response = await fetch(`/api/repository-status?owner=${owner}&repo=${repo}`);
        const data = await response.json();

        if (data.hasData) {
          clearInterval(pollInterval);
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
          clearInterval(pollInterval);
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

  // Calculate responsive height to match chart dimensions
  const cardHeight = 'h-[280px] md:h-[400px]';

  return (
    <Card className={`${cardHeight} ${className}`}>
      <CardContent className="h-full flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md mx-auto space-y-6">
          {/* Repository Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-muted rounded-full">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          {/* Repository Name */}
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              {owner}/{repo}
            </h2>
            <p className="text-muted-foreground">
              This repository is not being tracked yet
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Benefits */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Track this repository to unlock:</p>
            <ul className="mt-2 space-y-1 text-left inline-block">
              <li>• Contributor analytics and insights</li>
              <li>• Pull request activity visualization</li>
              <li>• Community health metrics</li>
              <li>• Historical contribution trends</li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            {!isLoggedIn ? (
              <Button 
                size="lg" 
                onClick={handleLogin}
                className="min-w-[200px]"
              >
                <Lock className="mr-2 h-4 w-4" />
                Login to Track Repository
              </Button>
            ) : (
              <Button 
                size="lg" 
                onClick={handleTrackRepository}
                disabled={isTracking}
                className="min-w-[200px]"
              >
                {isTracking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Tracking Repository...
                  </>
                ) : (
                  <>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Track This Repository
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Time Estimate */}
          <p className="text-xs text-muted-foreground">
            Data typically available within 1-2 minutes
          </p>
        </div>
      </CardContent>
    </Card>
  );
}