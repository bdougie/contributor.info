import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
// import { toast } from 'sonner'; // Commented out - no longer used after refactor

export interface DiscoveryState {
  status: 'checking' | 'discovered' | 'discovering' | 'ready' | 'error';
  repository: { id: string; owner: string; name: string } | null;
  message: string | null;
  isNewRepository: boolean;
}

interface DiscoveryOptions {
  owner: string | undefined;
  repo: string | undefined;
  enabled?: boolean;
  onDiscoveryComplete?: (repositoryId: string) => void;
}

/**
 * Hook to handle repository discovery for new/unknown repositories
 * Works with read-only database access by using server-side discovery
 */
export function useRepositoryDiscovery({
  owner,
  repo,
  enabled = true,
  onDiscoveryComplete,
}: DiscoveryOptions): DiscoveryState {
  const [state, setState] = useState<DiscoveryState>({
    status: 'checking',
    repository: null,
    message: null,
    isNewRepository: false,
  });

  const hasInitiatedDiscovery = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // const pollCountRef = useRef(0); // Commented out - no longer used after refactor
  // const MAX_POLL_COUNT = 60; // Commented out - no longer used after refactor

  useEffect(() => {
    if (!enabled || !owner || !repo) {
      setState({
        status: 'checking',
        repository: null,
        message: null,
        isNewRepository: false,
      });
      return;
    }

    const checkRepository = async () => {
      try {
        // Check if repository exists in database
        // Using maybeSingle() to handle non-existent repos without 406 errors
        console.log('[Repository Discovery] Checking repository:', `${owner}/${repo}`);
        const { data: repoData, error } = await supabase
          .from('repositories')
          .select('id, owner, name')
          .eq('owner', owner)
          .eq('name', repo)
          .maybeSingle();

        if (_error) {
          // Real error occurred
          console.error('Error checking repository:', _error);
          setState({
            status: 'error',
            repository: null,
            message: 'Failed to check repository status',
            isNewRepository: false,
          });
          return;
        }

        if (repoData) {
          // Repository exists! Show cached data immediately
          setState({
            status: 'ready',
            repository: repoData,
            message: null,
            isNewRepository: false,
          });
          return;
        }

        // Repository not found - initiate discovery
        setState({
          status: 'discovering',
          repository: null,
          message: `Setting up ${owner}/${repo}...`,
          isNewRepository: true,
        });

        // DISABLED: Old discovery flow - replaced with explicit tracking
        // Only initiate discovery once
        // if (!hasInitiatedDiscovery.current) {
        //   hasInitiatedDiscovery.current = true;
        //   await initiateDiscovery(owner, repo);
        // }

        // Just set the state to indicate it needs tracking
        // The user will use the new tracking card instead
      } catch () {
        console.error('Repository check error:', _error);
        setState({
          status: 'error',
          repository: null,
          message: 'Something went wrong. Please try again.',
          isNewRepository: false,
        });
      }
    };

    // DEPRECATED: This function is no longer used - replaced with manual tracking
    // Keeping for reference but commenting out to avoid TypeScript errors
    /*
    const initiateDiscovery = async (owner: string, repo: string) => {
      try {
        // Show user-friendly notification
        toast.info(`Setting up ${owner}/${repo}...`, {
          description: "This is a new repository! We're gathering contributor data for you. This usually takes 1-2 minutes.",
          duration: 8000,
          action: {
            label: 'Learn More',
            onClick: () => {
              toast.info('How it works', {
                description: 'We analyze pull requests, reviews, and contributions to show you insights about this repository.',
                duration: 6000
              });
            }
          }
        });

        // Send discovery request to API
        const response = await fetch('/api/discover-repository', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo })
        });

        if (!response.ok) {
          throw new Error('Discovery request failed');
        }

        const result = await response.json();
        console.log('Discovery initiated:', result);

        // Start polling for repository creation
        startPolling(owner, repo);

      } catch () {
        console.error('Failed to initiate discovery:', _error);
        
        setState({
          status: 'error',
          repository: null,
          message: 'Failed to set up repository. Please try refreshing the page.',
          isNewRepository: true
        });
        
        toast.error('Failed to set up repository', {
          description: 'Please try refreshing the page.',
          duration: 6000
        });
      }
    };
    */

    // DEPRECATED: Polling is no longer used - replaced with manual tracking
    /*
    const startPolling = (owner: string, repo: string) => {
      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollCountRef.current = 0;

      // Poll every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        pollCountRef.current++;

        // Stop polling after max attempts
        if (pollCountRef.current > MAX_POLL_COUNT) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          
          setState({
            status: 'error',
            repository: null,
            message: 'Repository setup is taking longer than expected. Please refresh the page.',
            isNewRepository: true
          });
          
          return;
        }

        // Check if repository now exists
        const { data: repoData } = await supabase
          .from('repositories')
          .select('id, owner, name')
          .eq('owner', owner)
          .eq('name', repo)
          .maybeSingle();

        if (repoData) {
          // Success! Repository is ready
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }

          setState({
            status: 'ready',
            repository: repoData,
            message: 'Repository is ready!',
            isNewRepository: true
          });

          toast.success('Repository data updated!', {
            description: 'Fresh data is now available',
            action: {
              label: 'Refresh',
              onClick: () => window.location.reload()
            },
            duration: 10000
          });

          // Notify parent component
          if (onDiscoveryComplete) {
            onDiscoveryComplete(repoData.id);
          }
        }
      }, 2000);
    };
    */

    checkRepository();

    // Cleanup
    return () => {
      hasInitiatedDiscovery.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [owner, repo, enabled, onDiscoveryComplete]);

  return state;
}
