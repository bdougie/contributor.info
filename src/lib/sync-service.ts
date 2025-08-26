// Sync service for repository data synchronization
// Intelligently routes to Netlify or Supabase based on operation size

import { supabase } from './supabase';

// Configuration
const USE_HYBRID_ROUTING = import.meta.env.VITE_USE_HYBRID_ROUTING === 'true';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SyncOptions {
  fullSync?: boolean;
  daysLimit?: number;
  prNumbers?: number[];
  forceSupabase?: boolean;
  forceNetlify?: boolean;
}

export interface SyncResult {
  success: boolean;
  processed?: number;
  errors?: number;
  executionTime?: string;
  partial?: boolean;
  resumeCursor?: string;
  router?: 'supabase' | 'inngest' | 'direct';
  message?: string;
}

// Known large repositories that need Supabase Edge Functions
const LARGE_REPOS = new Set([
  'pytorch/pytorch',
  'tensorflow/tensorflow',
  'kubernetes/kubernetes',
  'facebook/react',
  'microsoft/vscode',
  'torvalds/linux',
  'apache/spark',
  'elastic/elasticsearch',
]);

export class SyncService {
  /**
   * Sync repository data
   */
  static async syncRepository(
    owner: string,
    name: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const repository = `${owner}/${name}`;
    
    // Check if repository is tracked
    const { data: repo } = await supabase
      .from('repositories')
      .select('id, is_tracked, size_class')
      .eq('owner', owner)
      .eq('name', name)
      .maybeSingle();
    
    if (!repo?.is_tracked) {
      throw new Error('Repository is not tracked. Please track it first.');
    }
    
    // Determine routing strategy
    if (USE_HYBRID_ROUTING) {
      // Use hybrid router that intelligently chooses
      return this.callHybridRouter('sync', repository, options);
    } else if (this.shouldUseSupabase(repository, repo.size_class, options)) {
      // Direct call to Supabase Edge Function
      return this.callSupabaseFunction('repository-sync', { owner, name, ...options });
    } else {
      // Use Netlify function
      return this.callNetlifyFunction('sync-router', {
        action: 'sync',
        repository,
        options,
      });
    }
  }
  
  /**
   * Sync using GraphQL (more efficient for large repos)
   */
  static async syncRepositoryGraphQL(
    owner: string,
    name: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const repository = `${owner}/${name}`;
    
    // GraphQL sync is always better for large operations
    if (LARGE_REPOS.has(repository) || options.fullSync) {
      return this.callSupabaseFunction('repository-sync-graphql', { 
        owner, 
        name, 
        ...options 
      });
    }
    
    // Use hybrid router for intelligent routing
    return this.callHybridRouter('sync-graphql', repository, options);
  }
  
  /**
   * Batch process PR details
   */
  static async batchProcessPRs(
    owner: string,
    name: string,
    prNumbers: number[],
    options: Partial<SyncOptions> = {}
  ): Promise<SyncResult> {
    const repository = `${owner}/${name}`;
    
    // Large batches go to Supabase
    if (prNumbers.length > 50) {
      return this.callSupabaseFunction('pr-details-batch', {
        repository,
        prNumbers,
        ...options,
      });
    }
    
    // Small batches can use Netlify
    return this.callHybridRouter('batch-pr', repository, { 
      ...options, 
      prNumbers 
    });
  }
  
  /**
   * Resume a partial sync
   */
  static async resumeSync(
    owner: string,
    name: string,
    cursor: string
  ): Promise<SyncResult> {
    // Check if there's a saved progress
    const { data: progress } = await supabase
      .from('sync_progress')
      .select('*')
      .eq('repository_id', `${owner}/${name}`)
      .maybeSingle();
    
    if (progress) {
      // Resume with Supabase (since it was a long operation)
      return this.callSupabaseFunction('repository-sync-graphql', {
        owner,
        name,
        cursor: progress.last_cursor || cursor,
      });
    }
    
    // Start fresh sync
    return this.syncRepository(owner, name);
  }
  
  /**
   * Check sync status
   */
  static async getSyncStatus(owner: string, name: string): Promise<{
    issyncing: boolean;
    lastSync?: Date;
    progress?: number;
  }> {
    const { data: repo } = await supabase
      .from('repositories')
      .select('sync_status, last_synced_at')
      .eq('owner', owner)
      .eq('name', name)
      .maybeSingle();
    
    const { data: progress } = await supabase
      .from('sync_progress')
      .select('prs_processed, status')
      .eq('repository_id', `${owner}/${name}`)
      .maybeSingle();
    
    return {
      issyncing: repo?.sync_status === 'syncing' || progress?.status === 'partial',
      lastSync: repo?.last_synced_at ? new Date(repo.last_synced_at) : undefined,
      progress: progress?.prs_processed,
    };
  }
  
  // Private helper methods
  
  private static shouldUseSupabase(
    repository: string,
    sizeClass?: string,
    options?: SyncOptions
  ): boolean {
    if (options?.forceSupabase) return true;
    if (options?.forceNetlify) return false;
    if (LARGE_REPOS.has(repository)) return true;
    if (sizeClass === 'large' || sizeClass === 'huge') return true;
    if (options?.fullSync) return true;
    if (options?.daysLimit && options.daysLimit > 90) return true;
    return false;
  }
  
  private static async callHybridRouter(
    action: string,
    repository: string,
    options: SyncOptions
  ): Promise<SyncResult> {
    const response = await fetch('/.netlify/functions/sync-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, repository, options }),
    });
    
    if (!response.ok) {
      // Try to parse error as JSON, but handle non-JSON responses
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error._error || 'Sync failed');
    }
    
    return response.json();
  }
  
  private static async callSupabaseFunction(
    functionName: string,
    payload: any
  ): Promise<SyncResult> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase functions not configured. This is expected in deploy previews.');
      return {
        success: false,
        message: 'Supabase functions not configured yet',
        router: 'supabase'
      };
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );
    
    if (!response.ok) {
      // Handle 404 gracefully - function not deployed yet
      if (response.status === 404) {
        console.warn(`Supabase function ${functionName} not found. Deploy it with: supabase functions deploy ${functionName}`);
        return {
          success: false,
          message: `Function not deployed. Run: supabase functions deploy ${functionName}`,
          router: 'supabase'
        };
      }
      
      // Try to parse error as JSON, but handle non-JSON responses
      const result = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(result._error || 'Supabase function failed');
    }
    
    const result = await response.json();
    
    return { ...result, router: 'supabase' };
  }
  
  private static async callNetlifyFunction(
    functionName: string,
    payload: any
  ): Promise<SyncResult> {
    const response = await fetch(`/.netlify/functions/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      // Handle 404 gracefully in development/preview environments
      if (response.status === 404) {
        console.warn(`Function ${functionName} not found. This is expected in deploy previews before the PR is merged.`);
        return {
          success: false,
          message: 'Function not deployed yet. This is expected in deploy previews.',
          router: 'inngest'
        };
      }
      
      const error = await response.json().catch(() => ({ error: 'Unknown _error' }));
      throw new Error(error._error || 'Netlify function failed');
    }
    
    const result = await response.json();
    return { ...result, router: 'inngest' };
  }
}

// Export convenience functions
export const syncRepository = SyncService.syncRepository.bind(SyncService);
export const syncRepositoryGraphQL = SyncService.syncRepositoryGraphQL.bind(SyncService);
export const batchProcessPRs = SyncService.batchProcessPRs.bind(SyncService);
export const resumeSync = SyncService.resumeSync.bind(SyncService);
export const getSyncStatus = SyncService.getSyncStatus.bind(SyncService);