/**
 * useSlackIntegrations Hook
 * React hook for managing Slack integrations in a workspace
 */

import { useState, useEffect } from 'react';
import {
  getSlackIntegrationsWithStatus,
  createSlackIntegration,
  updateSlackIntegration,
  deleteSlackIntegration,
  testSlackIntegration,
} from '../services/slack-integration.service';
import type {
  SlackIntegrationWithStatus,
  CreateSlackIntegrationInput,
  UpdateSlackIntegrationInput
} from '../types/workspace';

interface UseSlackIntegrationsOptions {
  workspaceId: string;
  enabled?: boolean;
}

interface UseSlackIntegrationsReturn {
  integrations: SlackIntegrationWithStatus[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createIntegration: (input: CreateSlackIntegrationInput) => Promise<void>;
  updateIntegration: (id: string, input: UpdateSlackIntegrationInput) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  testIntegration: (id: string) => Promise<boolean>;
}

export function useSlackIntegrations({
  workspaceId,
  enabled = true,
}: UseSlackIntegrationsOptions): UseSlackIntegrationsReturn {
  const [integrations, setIntegrations] = useState<SlackIntegrationWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    if (!enabled || !workspaceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getSlackIntegrationsWithStatus(workspaceId);
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to fetch Slack integrations: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, enabled]);

  const handleCreateIntegration = async (input: CreateSlackIntegrationInput) => {
    try {
      setError(null);
      await createSlackIntegration(input);
      await fetchIntegrations();
    } catch (err) {
      console.error('Failed to create Slack integration: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to create integration');
      throw err;
    }
  };

  const handleUpdateIntegration = async (id: string, input: UpdateSlackIntegrationInput) => {
    try {
      setError(null);
      await updateSlackIntegration(id, input);
      await fetchIntegrations();
    } catch (err) {
      console.error('Failed to update Slack integration: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to update integration');
      throw err;
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    try {
      setError(null);
      await deleteSlackIntegration(id);
      await fetchIntegrations();
    } catch (err) {
      console.error('Failed to delete Slack integration: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to delete integration');
      throw err;
    }
  };

  const handleTestIntegration = async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await testSlackIntegration(id);
      await fetchIntegrations(); // Refresh to show new log
      return result;
    } catch (err) {
      console.error('Failed to test Slack integration: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to test integration');
      return false;
    }
  };

  return {
    integrations,
    loading,
    error,
    refetch: fetchIntegrations,
    createIntegration: handleCreateIntegration,
    updateIntegration: handleUpdateIntegration,
    deleteIntegration: handleDeleteIntegration,
    testIntegration: handleTestIntegration,
  };
}
