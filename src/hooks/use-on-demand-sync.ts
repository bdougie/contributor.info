import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import { getSyncRowError, isSyncStalled, SYNC_STALL_TIMEOUT_MS } from '@/lib/sync-status';

interface OnDemandSyncOptions {
  owner: string;
  repo: string;
  enabled?: boolean;
  autoTriggerOnEmpty?: boolean;
}

export interface SyncStatus {
  isTriggering: boolean;
  isInProgress: boolean;
  isComplete: boolean;
  isStalled: boolean;
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
    isStalled: false,
    error: null,
    lastSyncAt: null,
    eventsProcessed: null,
  });

  const [hasData, setHasData] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const syncTriggeredRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollDeadline = useRef(0);
  const repositoryKey = `${owner}/${repo}`;
  const activeRepository = useRef(repositoryKey);
  activeRepository.current = repositoryKey;

  // Check if repository has existing data
  const checkForExistingData = useCallback(async () => {
    if (!enabled || !owner || !repo) return;

    try {
      // Check authentication status
      const supabase = await getSupabase();
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
        .abortSignal(AbortSignal.timeout(15000))
        .limit(1);

      if (rolesError) {
        throw rolesError;
      }

      // Check sync status
      const { data: syncData, error: syncError } = await supabase
        .from('github_sync_status')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .abortSignal(AbortSignal.timeout(15000))
        .maybeSingle();

      if (syncError && syncError.code !== 'PGRST116') {
        throw syncError;
      }

      if (activeRepository.current !== repositoryKey) return;

      const hasExistingData = roles && roles.length > 0;
      setHasData(hasExistingData);

      // Update sync status if we have sync data
      if (syncData) {
        const stalled = isSyncStalled(syncData.sync_status, syncData.updated_at);
        setSyncStatus((prev) => ({
          ...prev,
          isInProgress: syncData.sync_status === 'in_progress' && !stalled,
          isComplete: syncData.sync_status === 'completed',
          isStalled: stalled,
          error: getSyncRowError(syncData),
          lastSyncAt: syncData.last_sync_at,
          eventsProcessed: syncData.events_processed,
        }));

        // Start polling if sync is in progress
        if (syncData.sync_status === 'in_progress' && !stalled) {
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
    } catch {
      if (activeRepository.current !== repositoryKey) return;
      setSyncStatus((prev) => ({
        ...prev,
        isInProgress: false,
        error: 'We could not check for repository updates. Please try again later.',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        isStalled: false,
        isComplete: false,
        error: null,
      }));

      // Get user's GitHub token from session
      const supabaseTrigger = await getSupabase();
      const {
        data: { session },
      } = await supabaseTrigger.auth.getSession();
      if (activeRepository.current !== repositoryKey) return;
      if (!session) throw new Error('Sign in with GitHub to refresh repository data.');
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
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(120000),
        }
      );

      const result = await response.json();
      if (activeRepository.current !== repositoryKey) return;

      // Process response

      if (
        !response.ok ||
        result.results?.some((entry: { status: string }) => entry.status === 'error')
      ) {
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
      if (activeRepository.current !== repositoryKey) return;
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';

      setSyncStatus((prev) => ({
        ...prev,
        isTriggering: false,
        isInProgress: false,
        error: errorMessage,
      }));

      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, enabled, syncStatus.isTriggering, syncStatus.isInProgress]);

  // Poll sync status
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollDeadline.current = Date.now() + SYNC_STALL_TIMEOUT_MS;

    pollIntervalRef.current = setInterval(async () => {
      if (activeRepository.current !== repositoryKey) return;
      if (Date.now() >= pollDeadline.current) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setSyncStatus((prev) => ({ ...prev, isInProgress: false, isStalled: true }));
        return;
      }
      try {
        const supabasePoll = await getSupabase();
        const { data: syncData, error: _error } = await supabasePoll
          .from('github_sync_status')
          .select('*')
          .eq('repository_owner', owner)
          .eq('repository_name', repo)
          .abortSignal(AbortSignal.timeout(15000))
          .maybeSingle();

        if (_error) {
          throw _error;
        }

        if (activeRepository.current !== repositoryKey) return;

        if (syncData) {
          const stalled = isSyncStalled(syncData.sync_status, syncData.updated_at);
          setSyncStatus((prev) => ({
            ...prev,
            isInProgress: syncData.sync_status === 'in_progress' && !stalled,
            isComplete: syncData.sync_status === 'completed',
            isStalled: stalled,
            error: getSyncRowError(syncData),
            lastSyncAt: syncData.last_sync_at,
            eventsProcessed: syncData.events_processed,
          }));

          // Stop polling if sync is complete or failed
          if (
            stalled ||
            syncData.sync_status === 'completed' ||
            syncData.sync_status === 'failed'
          ) {
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
      } catch {
        if (activeRepository.current !== repositoryKey) return;
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setSyncStatus((prev) => ({
          ...prev,
          isInProgress: false,
          error: 'We could not check for repository updates. Please try again later.',
        }));
      }
    }, 10000); // Poll every 10 seconds (reduced frequency)
  }, [owner, repo, repositoryKey, checkForExistingData]);

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
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    syncTriggeredRef.current = false; // Reset trigger flag for new repo
    setHasData(null);
    setSyncStatus({
      isTriggering: false,
      isInProgress: false,
      isComplete: false,
      isStalled: false,
      error: null,
      lastSyncAt: null,
      eventsProcessed: null,
    });
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
