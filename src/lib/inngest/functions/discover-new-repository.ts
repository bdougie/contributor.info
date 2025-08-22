import { inngest } from '../client';
import { createSupabaseAdmin } from '../../supabase-admin';
import { NonRetriableError } from 'inngest';

interface GitHubRepository {
  id: number;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: any;
  topics: string[];
  visibility: string;
  default_branch: string;
}

/**
 * Discover and set up a new repository
 * This function handles the complete lifecycle from unknown repo to tracked repo with data
 */
export const discoverNewRepository = inngest.createFunction(
  {
    id: "discover-new-repository",
    name: "Discover New Repository",
    concurrency: {
      limit: 10, // Allow parallel discoveries
      key: "event.data.owner/event.data.repo", // One discovery per repo at a time
    },
    retries: 2,
  },
  { event: "discover/repository.new" },
  async ({ event, step }) => {
    const { owner, repo, source } = event.data;
    
    // Validate required fields
    if (!owner || !repo) {
      console.error('Missing required fields in discovery event:', event.data);
      throw new NonRetriableError(`Missing required fields: owner=${owner}, repo=${repo}`);
    }
    
    const fullName = `${owner}/${repo}`;
    console.log('Starting discovery for %s from %s', fullName, source);

    // Create admin client for this function
    const supabase = createSupabaseAdmin();

    // Step 1: Check if repository already exists (race condition protection)
    const existingRepo = await step.run("check-existing-repository", async () => {
      const { data } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();
      
      return data;
    });

    if (existingRepo) {
      console.log('Repository %s already exists with ID %s', fullName, existingRepo.id);
      
      // Still trigger a sync in case it needs fresh data
      await step.sendEvent("trigger-sync-existing", {
        name: "capture/repository.sync.graphql",
        data: {
          repositoryId: existingRepo.id,
          days: 30,
          priority: 'high',
          reason: 'User discovery of existing repo'
        }
      });
      
      return {
        success: true,
        status: 'existing',
        repositoryId: existingRepo.id,
        message: `Repository ${fullName} already tracked`
      };
    }

    // Step 2: Fetch repository data from GitHub
    const githubData = await step.run("fetch-github-repository", async () => {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN}`,
          'User-Agent': 'contributor-info'
        }
      });

      if (response.status === 404) {
        throw new NonRetriableError(`Repository ${fullName} not found on GitHub`);
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data: GitHubRepository = await response.json();
      return data;
    });

    // Step 3: Create repository record
    const repository = await step.run("create-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .insert({
          github_id: githubData.id,
          full_name: githubData.full_name,
          owner: githubData.owner.login,
          name: githubData.name,
          description: githubData.description,
          homepage: githubData.homepage,
          language: githubData.language,
          stargazers_count: githubData.stargazers_count,
          watchers_count: githubData.watchers_count,
          forks_count: githubData.forks_count,
          open_issues_count: githubData.open_issues_count,
          size: githubData.size,
          default_branch: githubData.default_branch,
          is_fork: githubData.fork,
          is_archived: githubData.archived,
          is_disabled: githubData.disabled,
          is_private: githubData.private,
          has_issues: githubData.has_issues,
          has_projects: githubData.has_projects,
          has_wiki: githubData.has_wiki,
          has_pages: githubData.has_pages,
          has_downloads: githubData.has_downloads,
          license: githubData.license?.spdx_id || null,
          topics: githubData.topics || [],
          github_created_at: githubData.created_at,
          github_updated_at: githubData.updated_at,
          github_pushed_at: githubData.pushed_at,
          first_tracked_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          is_active: true
        })
        .select()
        .maybeSingle();

      if (error) {
        // Handle unique constraint violation (repo was created by another process)
        if (error.code === '23505') {
          const { data: existingRepo } = await supabase
            .from('repositories')
            .select('id')
            .eq('github_id', githubData.id)
            .maybeSingle();
          
          if (existingRepo) {
            return existingRepo;
          }
        }
        throw new Error(`Failed to create repository: ${error.message}`);
      }

      return data;
    });

    // Step 4: Add to tracked repositories
    await step.run("add-to-tracking", async () => {
      const { error } = await supabase
        .from('tracked_repositories')
        .insert({
          repository_id: repository.id,
          organization_name: owner,
          repository_name: repo,
          tracking_enabled: true,
          priority: 'high', // High priority for user-discovered repos
          added_by_user_id: null, // Could track authenticated user in future
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Failed to track repository: ${error.message}`);
        // Don't throw - repository exists which is the main goal
      }
    });

    // Step 5: Trigger classification
    await step.sendEvent("trigger-classification", {
      name: "classify/repository.single",
      data: {
        repositoryId: repository.id,
        owner,
        repo
      }
    });

    // Step 6: Trigger initial data sync
    await step.sendEvent("trigger-initial-sync", {
      name: "capture/repository.sync.graphql",
      data: {
        repositoryId: repository.id,
        days: 30, // Get last 30 days of data
        priority: 'high',
        reason: 'Initial repository discovery'
      }
    });

    console.log('Successfully discovered and set up %s with ID %s', fullName, repository.id);

    return {
      success: true,
      status: 'discovered',
      repositoryId: repository.id,
      repository: {
        id: repository.id,
        owner: repository.owner,
        name: repository.name,
        stars: repository.stargazers_count,
        language: repository.language
      },
      message: `Successfully discovered ${fullName}`
    };
  }
);