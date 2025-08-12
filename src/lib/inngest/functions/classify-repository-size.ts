import { inngest } from '../client';
import { RepositorySizeClassifier } from '../../repository-size-classifier';
import { supabase } from '../../supabase';

// Type for tracked repository with nested repository data
interface TrackedRepositoryWithRepo {
  id: string;
  repository_id: string;
  repositories: {
    id: string;
    owner: string;
    name: string;
  };
}

/**
 * Background job to classify repository sizes
 * Runs periodically to classify unclassified repositories and reclassify old ones
 */
export const classifyRepositorySize = inngest.createFunction(
  {
    id: 'classify-repository-size',
    name: 'Classify Repository Size',
    concurrency: {
      limit: 5, // Process up to 5 repositories concurrently
    },
    retries: 3,
  },
  [
    // Scheduled to run every 6 hours
    { cron: '0 */6 * * *' },
    // Also can be triggered manually
    { event: 'classify/repository.size' },
  ],
  async ({ step }) => {
    // Initialize classifier
    const githubToken = import.meta.env?.VITE_GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const classifier = new RepositorySizeClassifier(githubToken);

    // Step 1: Get unclassified repositories
    const unclassifiedRepos = await step.run('get-unclassified-repos', async () => {
      return await classifier.getUnclassifiedRepositories();
    });

    // Step 2: Classify each repository
    if (unclassifiedRepos.length > 0) {
      await step.run('classify-unclassified-batch', async () => {
        console.log(`Classifying ${unclassifiedRepos.length} unclassified repositories`);
        await classifier.classifyBatch(unclassifiedRepos);
      });
    }

    // Step 3: Reclassify old repositories (older than 30 days)
    await step.run('reclassify-old-repos', async () => {
      console.log('Reclassifying repositories older than 30 days');
      await classifier.reclassifyOldRepositories(30);
    });

    // Step 4: Update high-priority repositories more frequently
    const highPriorityRepos = await step.run('get-high-priority-repos', async () => {
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select(`
          id,
          repository_id,
          repositories!inner(
            id,
            owner,
            name
          )
        `)
        .eq('priority', 'high')
        .eq('tracking_enabled', true);

      if (error) {
        throw error;
      }

      // Cast the data to the expected shape
      const typedData = data as unknown as TrackedRepositoryWithRepo[];
      
      return typedData?.map((item) => ({
        id: item.id,
        owner: item.repositories.owner,
        name: item.repositories.name
      })) || [];
    });

    // Step 5: Reclassify high-priority repos if they're older than 7 days
    if (highPriorityRepos.length > 0) {
      await step.run('reclassify-high-priority-batch', async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        const { data, error } = await supabase
          .from('tracked_repositories')
          .select('id, size_calculated_at')
          .in('id', highPriorityRepos.map(r => r.id))
          .or(`size_calculated_at.is.null,size_calculated_at.lt.${cutoffDate.toISOString()}`);

        if (error) {
          throw error;
        }

        const reposToReclassify = highPriorityRepos.filter(repo => 
          data?.some(d => d.id === repo.id)
        );

        if (reposToReclassify.length > 0) {
          console.log(`Reclassifying ${reposToReclassify.length} high-priority repositories`);
          await classifier.classifyBatch(reposToReclassify);
        }
      });
    }

    return {
      unclassifiedCount: unclassifiedRepos.length,
      highPriorityCount: highPriorityRepos.length,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Function to classify a single repository on-demand
 */
export const classifySingleRepository = inngest.createFunction(
  {
    id: 'classify-single-repository',
    name: 'Classify Single Repository',
    retries: 3,
  },
  { event: 'classify/repository.single' },
  async ({ event, step }) => {
    const { repositoryId, owner, repo } = event.data;
    
    // Validate required fields
    if (!repositoryId || !owner || !repo) {
      console.error('Missing required fields in event data:', event.data);
      throw new Error(`Missing required fields: repositoryId=${repositoryId}, owner=${owner}, repo=${repo}`);
    }

    // Initialize classifier
    const githubToken = import.meta.env?.VITE_GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const classifier = new RepositorySizeClassifier(githubToken);

    // Classify the repository
    const size = await step.run('classify-repository', async () => {
      return await classifier.classifyAndUpdateRepository(repositoryId, owner, repo);
    });

    return {
      repositoryId,
      size,
      timestamp: new Date().toISOString()
    };
  }
);