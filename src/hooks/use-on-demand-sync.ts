import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface OnDemandSyncOptions {
  owner: string;
  repo: string;
  enabled?: boolean;
  autoTriggerOnEmpty?: boolean;
}

interface SyncStatus {
  isTriggering: boolean;
  isInProgress: boolean;
  isComplete: boolean;
  error: string | null;
  lastSyncAt: string | null;
  eventsProcessed: number | null;
}

export function useOnDemandSync({
  owner,
  repo,
  enabled = true,
  autoTriggerOnEmpty = true,
}: OnDemandSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isTriggering: false,
    isInProgress: false,
    isComplete: false,
    error: null,
    lastSyncAt: null,
    eventsProcessed: null,
  });

  const [hasData, setHasData] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const syncTriggeredRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if repository has existing data
  const checkForExistingData = useCallback(async () => {
    if (!enabled || !owner || !repo) return;

    try {
      // Check authentication status
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // Check data for repository

      // Check for contributor roles data
      const { data: roles, error: rolesError } = await supabase
        .from('contributor_roles')
        .select('id')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .limit(1);

      if (rolesError) {
        return;
      }

      // Check sync status
      const { data: syncData, error: syncError } = await supabase
        .from('github_sync_status')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .maybeSingle();

      if (syncError && syncError.code !== 'PGRST116') {
        return;
      }

      const hasExistingData = roles && roles.length > 0;
      setHasData(hasExistingData);

      // Update sync status if we have sync data
      if (syncData) {
        setSyncStatus((prev) => ({
          ...prev,
          isInProgress: syncData.sync_status === 'in_progress',
          isComplete: syncData.sync_status === 'completed',
          error: syncData.error_message,
          lastSyncAt: syncData.last_sync_at,
          eventsProcessed: syncData.events_processed,
        }));

        // Start polling if sync is in progress
        if (syncData.sync_status === 'in_progress') {
          startPolling();
        }
      }

      // Auto-trigger sync if no data exists, user is authenticated, and not already triggered
      if (
        autoTriggerOnEmpty &&
        !hasExistingData &&
        !syncTriggeredRef.current &&
        !syncData?.sync_status &&
        session
      ) {
        triggerSync();
      }
    } catch (error) {
      // Silently handle data check errors
    }
  }, [owner, repo, enabled, autoTriggerOnEmpty]);

  // Trigger GitHub sync
  const triggerSync = useCallback(async () => {
    if (!enabled || !owner || !repo || syncStatus.isTriggering || syncStatus.isInProgress) {
      return;
    }

    try {
      syncTriggeredRef.current = true;
      setSyncStatus((prev) => ({
        ...prev,
        isTriggering: true,
        error: null,
      }));

      // Get user's GitHub token from session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userToken = session?.provider_token;

      // Trigger sync for repository

      const requestBody = {
        owner,
        repository: repo,
        github_token: userToken, // Pass user's token to Edge Function
      };

      // Call Edge Function

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-sync`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      // Process response

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      setSyncStatus((prev) => ({
        ...prev,
        isTriggering: false,
        isInProgress: true,
        error: null,
      }));

      // Start polling for completion
      startPolling();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';

      setSyncStatus((prev) => ({
        ...prev,
        isTriggering: false,
        isInProgress: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, [owner, repo, enabled, syncStatus.isTriggering, syncStatus.isInProgress]);

  // Poll sync status
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data: syncData, error } = await supabase
          .from('github_sync_status')
          .select('*')
          .eq('repository_owner', owner)
          .eq('repository_name', repo)
          .maybeSingle();

        if (error) {
          return;
        }

        if (syncData) {
          setSyncStatus((prev) => ({
            ...prev,
            isInProgress: syncData.sync_status === 'in_progress',
            isComplete: syncData.sync_status === 'completed',
            error: syncData.error_message,
            lastSyncAt: syncData.last_sync_at,
            eventsProcessed: syncData.events_processed,
          }));

          // Stop polling if sync is complete or failed
          if (syncData.sync_status === 'completed' || syncData.sync_status === 'failed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            // Recheck for data after successful sync
            if (syncData.sync_status === 'completed') {
              setTimeout(() => {
                checkForExistingData();
              }, 1000);
            }
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    }, 10000); // Poll every 10 seconds (reduced frequency)
  }, [owner, repo, checkForExistingData]);

  // Stop polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Check for existing data when params change
  useEffect(() => {
    syncTriggeredRef.current = false; // Reset trigger flag for new repo
    checkForExistingData();
  }, [checkForExistingData]);

  return {
    hasData,
    isAuthenticated,
    syncStatus,
    triggerSync,
    refetch: checkForExistingData,
  };
}
