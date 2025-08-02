import { supabase } from '../supabase';

interface SyncLogMetadata {
  [key: string]: unknown;
}

export class SyncLogger {
  private syncLogId: string | null = null;
  
  async start(syncType: string, repositoryId: string, metadata?: SyncLogMetadata): Promise<string> {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        sync_type: syncType,
        repository_id: repositoryId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        metadata: metadata || {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create sync log:', error);
      throw error;
    }

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
      console.error('Failed to update sync log:', error);
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
        ...summary
      })
      .eq('id', this.syncLogId);

    if (error) {
      console.error('Failed to complete sync log:', error);
    }
  }

  async fail(errorMessage: string, summary?: {
    records_processed?: number;
    records_inserted?: number;
    records_updated?: number;
    records_failed?: number;
    github_api_calls_used?: number;
    rate_limit_remaining?: number;
    metadata?: SyncLogMetadata;
  }): Promise<void> {
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
        ...summary
      })
      .eq('id', this.syncLogId);

    if (error) {
      console.error('Failed to mark sync log as failed:', error);
    }
  }
}