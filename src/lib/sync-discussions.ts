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
 * Triggers background sync of discussion data from GitHub via Inngest
 * @param owner Repository owner
 * @param repo Repository name
 * @param workspaceId Optional workspace ID for tracking
 * @param options Sync options for controlling what data to fetch
 * @returns Summary of sync operation (note: actual processing happens in background)
 */
export async function syncDiscussions(
  owner: string,
  repo: string,
  workspaceId?: string,
  options: SyncOptions = {}
): Promise<{ success: boolean; total: number; successful: number; failed: number }> {
  try {
    const { maxItems = 100, updateDatabase = true } = options;

    console.log('Triggering discussion sync for %s/%s', owner, repo, {
      maxItems,
      updateDatabase,
    });

    // Call edge function to trigger Inngest job
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
      console.error('Error triggering discussion sync:', error);
      throw new Error(`Failed to trigger discussion sync: ${error.message}`);
    }

    if (!data.success) {
      console.error('Sync trigger failed:', data.error);
      throw new Error(data.message || 'Failed to trigger discussion sync');
    }

    console.log(
      'Discussion sync job triggered successfully. Job ID: %s',
      data.data?.jobId || 'unknown'
    );

    // Return success immediately - actual processing happens in background
    // The UI will poll the database for updated data
    return {
      success: true,
      total: 0, // Unknown until job completes
      successful: 0, // Unknown until job completes
      failed: 0, // Unknown until job completes
    };
  } catch (error) {
    console.error('Failed to trigger discussion sync:', error);
    throw error;
  }
}
