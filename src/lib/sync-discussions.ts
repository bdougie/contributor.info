import { supabase } from '@/lib/supabase';

export interface DiscussionWithAuthor {
  github_id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  repository_owner: string;
  repository_name: string;
  author: {
    username: string;
    avatar_url: string;
  };
  category: string;
  created_at: string;
  updated_at: string;
  answer_chosen_at: string | null;
  is_answered: boolean;
  comments_count: number;
}

export interface SyncOptions {
  maxItems?: number; // How many discussions to fetch (max 100)
  updateDatabase?: boolean; // Whether to update database with fetched data
}

/**
 * Fetches the latest discussion data from GitHub via Edge Function
 * @param owner Repository owner
 * @param repo Repository name
 * @param workspaceId Optional workspace ID for tracking
 * @param options Sync options for controlling what data to fetch
 * @returns Summary of sync operation
 */
export async function syncDiscussions(
  owner: string,
  repo: string,
  workspaceId?: string,
  options: SyncOptions = {}
): Promise<{ success: boolean; total: number; successful: number; failed: number }> {
  try {
    const { maxItems = 100, updateDatabase = true } = options;

    console.log('Syncing discussions for %s/%s', owner, repo, {
      maxItems,
      updateDatabase,
    });

    // Call edge function to sync discussions
    const { data, error } = await supabase.functions.invoke('sync-discussions', {
      body: {
        owner,
        repo,
        workspace_id: workspaceId,
        max_items: maxItems,
        update_database: updateDatabase,
      },
    });

    if (error) {
      console.error('Error syncing discussions via edge function:', error);
      throw new Error(`Failed to sync discussions: ${error.message}`);
    }

    if (!data.success) {
      console.error('Sync failed:', data.error);
      throw new Error(data.message || 'Failed to sync discussions');
    }

    console.log(
      'Successfully synced %d discussions (%d succeeded, %d failed)',
      data.summary?.total || 0,
      data.summary?.successful || 0,
      data.summary?.failed || 0
    );

    return {
      success: true,
      total: data.summary?.total || 0,
      successful: data.summary?.successful || 0,
      failed: data.summary?.failed || 0,
    };
  } catch (error) {
    console.error('Failed to sync discussions:', error);
    throw error;
  }
}
