import { inngest } from '../client';
import { 
  getItemsNeedingEmbeddings, 
  generateAndStoreEmbeddings 
} from '../../../../app/services/embeddings';
import { supabase } from '../../supabase';

/**
 * Generate embeddings for issues and PRs in a repository
 */
export const generateEmbeddings = inngest.createFunction(
  {
    id: 'generate-embeddings',
    name: 'Generate Embeddings for Issues/PRs',
    concurrency: {
      limit: 5, // Limit concurrent executions to avoid rate limits
    },
  },
  { event: 'embeddings.generate' },
  async ({ event, step }) => {
    const { repositoryId, limit = 50 } = event.data;

    // Get repository details
    const repository = await step.run('get-repository', async () => {
      const { data } = await supabase
        .from('repositories')
        .select('id, full_name')
        .eq('id', repositoryId)
        .single();
      
      if (!data) {
        throw new Error(`Repository ${repositoryId} not found`);
      }
      
      return data;
    });

    // Get items needing embeddings
    const items = await step.run('get-items-needing-embeddings', async () => {
      return await getItemsNeedingEmbeddings(repositoryId, limit);
    });

    if (items.length === 0) {
      return {
        message: 'No items need embeddings',
        repository: repository.full_name,
      };
    }

    // Generate embeddings in batches
    await step.run('generate-embeddings', async () => {
      await generateAndStoreEmbeddings(items);
    });

    return {
      message: `Generated embeddings for ${items.length} items`,
      repository: repository.full_name,
      itemsProcessed: items.length,
    };
  }
);

/**
 * Batch generate embeddings for all tracked repositories
 */
export const batchGenerateEmbeddings = inngest.createFunction(
  {
    id: 'batch-generate-embeddings',
    name: 'Batch Generate Embeddings',
  },
  { cron: '0 */6 * * *' }, // Run every 6 hours
  async ({ step }) => {
    // Get all tracked repositories
    const repositories = await step.run('get-tracked-repositories', async () => {
      const { data } = await supabase
        .from('tracked_repositories')
        .select('repository_id')
        .eq('is_active', true)
        .limit(100); // Process top 100 active repos
      
      return data || [];
    });

    // Queue embedding generation for each repository
    await step.run('queue-embedding-jobs', async () => {
      const events = repositories.map(repo => ({
        name: 'embeddings.generate' as const,
        data: {
          repositoryId: repo.repository_id,
          limit: 50,
        },
      }));

      if (events.length > 0) {
        await inngest.send(events);
      }
    });

    return {
      message: `Queued embedding generation for ${repositories.length} repositories`,
    };
  }
);