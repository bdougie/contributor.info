import type { Context } from '@netlify/functions';

/**
 * Blocked owner names that are app routes, not GitHub organizations
 * These should never be treated as repository identifiers
 */
const BLOCKED_OWNERS = new Set([
  'social-cards',
  'api',
  'dev',
  'admin',
  'docs',
  'feed',
  'workspace',
  'workspaces',
  'settings',
  'auth',
  'callback',
  'trending',
  'changelog',
  'terms',
  'privacy',
  'faq',
  'debug',
  'health',
  'status',
  'assets',
  'public',
  'static',
]);

export default async (req: Request, context: Context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Parse request body
    let body: { owner?: string; repo?: string };
    try {
      body = await req.json();
    } catch (parseError) {
      // Handle malformed JSON
      body = {};
    }
    const { owner, repo } = body;

    // Validate repository parameters
    const isValidRepoName = (name: string): boolean => /^[a-zA-Z0-9._-]+$/.test(name);

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing owner or repo',
          message: 'Please provide both owner and repo parameters',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Block app routes that aren't GitHub repositories
    if (BLOCKED_OWNERS.has(owner.toLowerCase())) {
      console.warn(`Blocked tracking attempt for app route: ${owner}/${repo}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid repository',
          message: `'${owner}' is a reserved path and cannot be tracked as a repository`,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate format to prevent injection attacks
    if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid repository format',
          message:
            'Repository names can only contain letters, numbers, dots, underscores, and hyphens',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate length constraints
    if (owner.length > 39 || repo.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid repository name length',
          message: 'Repository or organization name is too long',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Check if user is authenticated
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const isAuthenticated = !!authHeader;

    // First, verify the repository exists on GitHub
    let githubData: any = null;
    try {
      // In production, we need a GitHub token to avoid rate limits
      const githubToken = process.env.GITHUB_TOKEN;

      // Detect if we're in production
      const isProduction =
        process.env.CONTEXT === 'production' ||
        process.env.NODE_ENV === 'production' ||
        process.env.NETLIFY === 'true';

      if (isProduction && !githubToken) {
        console.error('Missing GitHub token in production environment');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Configuration error',
            message: 'Service temporarily unavailable. Please try again later.',
          }),
          {
            status: 503,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'contributor-info',
          ...(githubToken && {
            Authorization: `token ${githubToken}`,
          }),
        },
      });

      if (githubResponse.status === 404) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Repository not found',
            message: `Repository ${owner}/${repo} not found on GitHub`,
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      if (!githubResponse.ok) {
        throw new Error(`GitHub API error: ${githubResponse.status}`);
      }

      githubData = await githubResponse.json();

      // Check if it's a private repository
      if (githubData.private) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Private repository',
            message: 'Cannot track private repositories',
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    } catch (githubError: any) {
      // Log the actual error for debugging
      console.error('GitHub API call failed:', githubError);
      console.error('GitHub error details:', {
        message: githubError.message,
        status: githubError.status,
        hasToken: !!process.env.GITHUB_TOKEN,
      });

      // In production, GitHub data is REQUIRED - we cannot proceed without it
      // The github_id is critical for all downstream processing
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GitHub API error',
          message: 'Unable to fetch repository data from GitHub. Please try again later.',
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Directly insert repository into database instead of relying on Inngest
    // (Inngest discovery function is not processing events in production)
    try {
      // Import Supabase admin client
      const { createClient } = await import('@supabase/supabase-js');

      // Get Supabase credentials
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      // Use service key if available, otherwise use anon key (for local dev)
      const supabaseKey = supabaseServiceKey || supabaseAnonKey;

      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase keys');
        // Fallback to sending Inngest event
        const inngestEventKey =
          process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;

        if (inngestEventKey && inngestEventKey !== 'local_development_only') {
          const inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
          await fetch(inngestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'discover/repository.new',
              data: {
                owner,
                repo,
                source: 'user-tracking',
                userId: isAuthenticated ? 'authenticated-user' : null,
                timestamp: new Date().toISOString(),
              },
            }),
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Tracking request received for ${owner}/${repo}`,
            warning: 'Background processing may be delayed',
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Step 1: Check if repository already exists in database
      const { data: existingRepos, error: checkError } = await supabase
        .from('repositories')
        .select('id, owner, name, github_id')
        .eq('owner', owner)
        .eq('name', repo);

      if (checkError) {
        console.error('Error checking existing repository:', checkError);
        throw new Error('Failed to check repository');
      }

      if (existingRepos && existingRepos.length > 0) {
        // Repository already exists
        const existingRepo = existingRepos[0];

        // Update repository with latest GitHub data
        const updateData: any = {
          is_active: true,
          last_updated_at: new Date().toISOString(),
        };

        // If github_id is missing or we have fresh GitHub data, update it
        if ((!existingRepo.github_id || githubData) && githubData) {
          Object.assign(updateData, {
            github_id: githubData.id,
            full_name: githubData.full_name,
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
          });
        }

        const { error: updateError } = await supabase
          .from('repositories')
          .update(updateData)
          .eq('id', existingRepo.id);

        if (updateError) {
          console.error('Failed to update repository with GitHub data:', updateError);
        }

        // Send sync event for existing repository
        try {
          const { Inngest } = await import('inngest');

          // Same environment detection as above
          const isLocal =
            process.env.NODE_ENV === 'development' ||
            process.env.NETLIFY_DEV === 'true' ||
            process.env.CONTEXT === 'dev' ||
            (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME);

          const eventKey = isLocal
            ? 'local-dev-key'
            : process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY;

          const inngest = new Inngest({
            id: 'contributor-info',
            isDev: isLocal,
            eventKey,
            ...(isLocal && { baseUrl: 'http://127.0.0.1:8288' }),
          });

          // Send sync event for the existing repository
          // Handle each event separately to ensure repository sync succeeds even if commit capture fails
          let syncResult;
          try {
            syncResult = await inngest.send({
              name: 'capture/repository.sync.graphql',
              data: {
                repositoryId: existingRepo.id,
                owner: existingRepo.owner,
                name: existingRepo.name,
                days: 30,
                priority: 'high',
                reason: 'Re-tracking existing repository',
              },
            });
            console.log('Repository sync event sent successfully:', syncResult.ids);
          } catch (syncError) {
            console.error('Failed to send repository sync event:', syncError);
            // Still continue - repository tracking can proceed without commit capture
          }

          // Try to send commit capture event separately
          try {
            const commitResult = await inngest.send({
              name: 'capture/commits.update',
              data: {
                repositoryId: existingRepo.id,
                repositoryName: `${existingRepo.owner}/${existingRepo.name}`,
                days: 1, // Incremental update for existing repos
                priority: 'medium',
                forceInitial: false,
                reason: 'Re-tracking existing repository',
              },
            });
            console.log('Commit capture event sent successfully:', commitResult.ids);
          } catch (commitError) {
            console.error('Failed to send commit capture event:', commitError);
            // Log but don't fail the overall operation
            console.log('Repository will be tracked but commit capture may be delayed');
          }
        } catch (eventError) {
          console.error('Failed to send events:', eventError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Repository ${owner}/${repo} is already being tracked`,
            repositoryId: existingRepo.id,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Step 2: Create repository record directly
      // At this point we MUST have githubData since we return early on GitHub API failures
      if (!githubData) {
        console.error('Critical error: githubData is null but we should have returned earlier');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Data validation error',
            message: 'Unable to process repository data. Please try again.',
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const repositoryData = {
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
        is_active: true,
      };

      const { data: repository, error: insertError } = await supabase
        .from('repositories')
        .insert(repositoryData)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert repository:', insertError);
        console.error('Insert error details:', JSON.stringify(insertError, null, 2));
        throw new Error(
          `Failed to create repository record: ${insertError.message || 'Unknown error'}`
        );
      }

      if (!repository) {
        throw new Error('Repository creation returned no data');
      }

      // Step 3: Add to tracked_repositories table
      const { error: trackError } = await supabase.from('tracked_repositories').insert({
        repository_id: repository.id,
        organization_name: owner,
        repository_name: repo,
        tracking_enabled: true,
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (trackError && trackError.code !== '23505') {
        // Ignore duplicate key errors
        console.error('Failed to track repository:', trackError);
        // Don't throw - repository exists which is the main goal
      }

      // Step 4: Send Inngest events for background processing using the SDK
      try {
        // Import Inngest SDK
        const { Inngest } = await import('inngest');

        // Detect if we're in local development
        // Check multiple indicators since Netlify Dev doesn't always set NODE_ENV
        const isLocal =
          process.env.NODE_ENV === 'development' ||
          process.env.NETLIFY_DEV === 'true' ||
          process.env.CONTEXT === 'dev' ||
          (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME);

        console.log('Inngest environment detection:', {
          NODE_ENV: process.env.NODE_ENV,
          NETLIFY_DEV: process.env.NETLIFY_DEV,
          CONTEXT: process.env.CONTEXT,
          NETLIFY: process.env.NETLIFY,
          AWS_LAMBDA: process.env.AWS_LAMBDA_FUNCTION_NAME,
          isLocal,
        });

        // For local development, don't use production keys
        const eventKey = isLocal
          ? 'local-dev-key' // Always use local key for local dev
          : process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY;

        const inngest = new Inngest({
          id: 'contributor-info',
          isDev: isLocal,
          eventKey,
          // For local dev, events MUST go to local dev server
          ...(isLocal && { baseUrl: 'http://127.0.0.1:8288' }),
        });

        console.log('Inngest client configuration:', {
          id: 'contributor-info',
          isDev: isLocal,
          eventKey: eventKey ? '***' : 'none',
          baseUrl: isLocal ? 'http://127.0.0.1:8288' : 'default',
        });

        // Send events through the SDK
        // Send critical events first, then optional ones
        const criticalEvents = [
          {
            name: 'classify/repository.single',
            data: {
              repositoryId: repository.id,
              owner,
              repo,
            },
          },
          {
            name: 'capture/repository.sync.graphql',
            data: {
              repositoryId: repository.id,
              owner: repository.owner,
              name: repository.name,
              days: 30,
              priority: 'high',
              reason: 'Initial repository discovery',
            },
          },
        ];

        // Send critical events first (classification and repository sync)
        const results = await inngest.send(criticalEvents);
        console.log('Critical events sent successfully:', results.ids);

        // Try to send commit capture event separately (non-critical)
        try {
          const commitEvent = {
            name: 'capture/commits.initial',
            data: {
              repositoryId: repository.id,
              repositoryName: `${repository.owner}/${repository.name}`,
              days: 7, // Initial capture for 7 days as per configuration
              priority: 'high',
              forceInitial: true,
              reason: 'Initial repository discovery',
            },
          };

          const commitResult = await inngest.send(commitEvent);
          console.log('Commit capture event sent successfully:', commitResult.ids);
        } catch (commitError) {
          console.error('Failed to send commit capture event:', commitError);
          console.log('Repository tracking will continue, but commit capture may be delayed');
          // Don't fail the overall operation - repository tracking is more important
        }
      } catch (eventError) {
        console.error('Failed to send Inngest events:', eventError);
        // Don't throw - events are non-critical for tracking success
      }

      console.log(
        'Successfully tracked repository %s with ID %s',
        `${owner}/${repo}`,
        repository.id
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully started tracking ${owner}/${repo}`,
          repositoryId: repository.id,
          repository: {
            id: repository.id,
            owner: repository.owner,
            name: repository.name,
            stars: repository.stargazers_count || 0,
            language: repository.language || null,
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      console.error('Failed to track repository:', error);

      // Still return success to not break the UI
      return new Response(
        JSON.stringify({
          success: true,
          message: `Tracking request received for ${owner}/${repo}`,
          warning: 'Processing may be delayed',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'Failed to track repository. Please try again.',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
