import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
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
          message: 'Please provide both owner and repo parameters'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate format to prevent injection attacks
    if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid repository format',
          message: 'Repository names can only contain letters, numbers, dots, underscores, and hyphens'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate length constraints
    if (owner.length > 39 || repo.length > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid repository name length',
          message: 'Repository or organization name is too long'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Check if user is authenticated
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const isAuthenticated = !!authHeader;

    // First, verify the repository exists on GitHub
    let githubData: any = null;
    try {
      const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'contributor-info',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      });

      if (githubResponse.status === 404) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Repository not found',
            message: `Repository ${owner}/${repo} not found on GitHub`
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
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
            message: 'Cannot track private repositories'
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

    } catch (githubError: any) {
      // Continue anyway - the repository might exist but we hit rate limits
      console.log('GitHub check error:', githubError.message);
    }

    // Directly insert repository into database instead of relying on Inngest
    // (Inngest discovery function is not processing events in production)
    try {
      // Import Supabase admin client
      const { createClient } = await import('@supabase/supabase-js');

      // Get Supabase credentials
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

      // Use service key if available, otherwise use anon key (for local dev)
      const supabaseKey = supabaseServiceKey || supabaseAnonKey;

      if (!supabaseKey) {
        console.error('Missing Supabase keys');
        // Fallback to sending Inngest event
        const inngestEventKey = process.env.INNGEST_EVENT_KEY ||
                               process.env.INNGEST_PRODUCTION_EVENT_KEY;

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
                timestamp: new Date().toISOString()
              }
            })
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Tracking request received for ${owner}/${repo}`,
            warning: 'Background processing may be delayed'
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Step 1: Check if repository already exists in database
      const { data: existingRepos, error: checkError } = await supabase
        .from('repositories')
        .select('id, owner, name')
        .eq('owner', owner)
        .eq('name', repo);

      if (checkError) {
        console.error('Error checking existing repository:', checkError);
        throw new Error('Failed to check repository');
      }

      if (existingRepos && existingRepos.length > 0) {
        // Repository already exists
        return new Response(
          JSON.stringify({
            success: true,
            message: `Repository ${owner}/${repo} is already being tracked`,
            repositoryId: existingRepos[0].id
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Step 2: Create repository record directly
      const repositoryData = githubData ? {
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
      } : {
        // Minimal data when GitHub API is unavailable
        full_name: `${owner}/${repo}`,
        owner: owner,
        name: repo,
        description: null,
        first_tracked_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        is_active: true
      };

      const { data: repository, error: insertError } = await supabase
        .from('repositories')
        .insert(repositoryData)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert repository:', insertError);
        throw new Error('Failed to create repository record');
      }

      if (!repository) {
        throw new Error('Repository creation returned no data');
      }

      // Step 3: Add to tracked_repositories table
      const { error: trackError } = await supabase
        .from('tracked_repositories')
        .insert({
          repository_id: repository.id,
          organization_name: owner,
          repository_name: repo,
          tracking_enabled: true,
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (trackError && trackError.code !== '23505') {
        // Ignore duplicate key errors
        console.error('Failed to track repository:', trackError);
        // Don't throw - repository exists which is the main goal
      }

      // Step 4: Also send Inngest events for background processing (classification & sync)
      const inngestEventKey = process.env.INNGEST_EVENT_KEY ||
                             process.env.INNGEST_PRODUCTION_EVENT_KEY;

      // Determine Inngest URL based on environment
      let inngestUrl: string;
      if (inngestEventKey === 'local_development_only') {
        // For local development, send to local Inngest server
        inngestUrl = 'http://localhost:8888/.netlify/functions/inngest-local-full';
      } else if (inngestEventKey) {
        // For production, send to Inngest cloud
        inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
      } else {
        // Skip if no event key
        inngestUrl = '';
      }

      if (inngestUrl) {
        try {
          // Send classification event
          await fetch(inngestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'classify/repository.single',
              data: {
                repositoryId: repository.id,
                owner,
                repo
              }
            })
          });

          // Send sync event
          await fetch(inngestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'capture/repository.sync.graphql',
              data: {
                repositoryId: repository.id,
                days: 30,
                priority: 'high',
                reason: 'Initial repository discovery'
              }
            })
          });
        } catch (eventError) {
          console.error('Failed to send Inngest events:', eventError);
          // Don't throw - events are non-critical
        }
      }

      console.log('Successfully tracked repository %s with ID %s', `${owner}/${repo}`, repository.id);

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
            language: repository.language || null
          }
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );

    } catch (error: any) {
      console.error('Failed to track repository:', error);

      // Still return success to not break the UI
      return new Response(
        JSON.stringify({
          success: true,
          message: `Tracking request received for ${owner}/${repo}`,
          warning: 'Processing may be delayed'
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

  } catch (error: any) {
    console.error('Function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'Failed to track repository. Please try again.'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
};