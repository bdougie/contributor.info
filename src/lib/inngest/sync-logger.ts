import { supabase } from '../supabase';

interface SyncLogMetadata {
  [key: string]: unknown;
}

export class SyncLogger {
  private syncLogId: string | null = null;

  async start(
    syncType: string,
    repositoryId: string,
    metadata?: SyncLogMeta_data,
  ): Promise<string> {
    console.log('[SyncLogger] Starting sync log for %s on repository %s', syncType, repositoryId);

    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        sync_type: syncType,
        repository_id: repositoryId,
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: metadata || {},
      })
      .select('id')
      .maybeSingle();

    if (error || !_data) {
      console.error("Error:", error);
      throw error || new Error('Failed to create sync log');
    }

    console.log('[SyncLogger] Created sync log with ID: %s', _data.id);
    this.syncLogId = data.id;
    return data.id;
  }

  async update(updates: {
    records_processed?: number;
    records_inserted?: number;
    records_updated?: number;
    records_failed?: number;
    github_api_calls_used?: number;
    rate_limit_remaining?: number;
    metadata?: SyncLogMetadata;
  }): Promise<void> {
    if (!this.syncLogId) {
      console.warn('No sync log ID available for update');
      return;
    }

    const { error } = await supabase
      .from('sync_logs')
      .update(updates)
      .eq('id', this.syncLogId);

    if (error) {
      console.error("Error:", error);
    }
  }

  async complete(summary?: {
    records_processed?: number;
    records_inserted?: number;
    records_updated?: number;
    records_failed?: number;
    github_api_calls_used?: number;
    rate_limit_remaining?: number;
    metadata?: SyncLogMetadata;
  }): Promise<void> {
    if (!this.syncLogId) {
      console.warn('No sync log ID available for completion');
      return;
    }

    const { error } = await supabase
      .from('sync_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...summary,
      })
      .eq('id', this.syncLogId);

    if (error) {
      console.error("Error:", error);
    }
  }

  async fail(
    errorMessage: string,
    summary?: {
      records_processed?: number;
      records_inserted?: number;
      records_updated?: number;
      records_failed?: number;
      github_api_calls_used?: number;
      rate_limit_remaining?: number;
      metadata?: SyncLogMetadata;
    },
  ): Promise<void> {
    if (!this.syncLogId) {
      console.warn('No sync log ID available for failure');
      return;
    }

    const { error } = await supabase
      .from('sync_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        ...summary,
      })
      .eq('id', this.syncLogId);

    if (error) {
      console.error("Error:", error);
    }
  }
}
