import { InstallationEvent, InstallationRepositoriesEvent } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { inngest } from '../../src/lib/inngest/client';
import { githubAppAuth } from '../lib/auth';
import { indexGitHistory } from '../services/git-history';
import { generateFileEmbeddings } from '../services/file-embeddings';

/**
 * Handle GitHub App installation events
 */
export async function handleInstallationEvent(event: InstallationEvent) {
  console.log(`Installation ${event.action}: ${event.installation.account.login}`);

  switch (event.action) {
    case 'created':
      await handleInstallationCreated(event);
      break;
    case 'deleted':
      await handleInstallationDeleted(event);
      break;
    case 'suspend':
      await handleInstallationSuspended(event);
      break;
    case 'unsuspend':
      await handleInstallationUnsuspended(event);
      break;
    case 'new_permissions_accepted':
      await handleNewPermissionsAccepted(event);
      break;
  }
}

/**
 * Handle installation repository events (repos added/removed)
 */
export async function handleInstallationRepositoriesEvent(event: InstallationRepositoriesEvent) {
  console.log(`Installation repos ${event.action} for ${event.installation.account.login}`);

  if (event.action === 'added' && event.repositories_added) {
    await handleRepositoriesAdded(event.installation, event.repositories_added);
  }

  if (event.action === 'removed' && event.repositories_removed) {
    await handleRepositoriesRemoved(event.installation, event.repositories_removed);
  }
}

/**
 * Handle new installation
 */
async function handleInstallationCreated(event: InstallationEvent) {
  try {
    // Store installation in database
    const { data: installation, error } = await supabase
      .from('github_app_installations')
      .upsert({
        installation_id: event.installation.id,
        account_type: event.installation.account.type.toLowerCase(),
        account_name: event.installation.account.login,
        account_id: event.installation.account.id,
        repository_selection: event.installation.repository_selection,
        installed_at: new Date().toISOString(),
        settings: {
          enabled: true,
          comment_on_prs: true,
          include_issue_context: true,
          comment_style: 'detailed',
        },
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error storing installation:', error);
      return;
    }

    // If specific repos are selected, store them
    if (event.repositories && event.repositories.length > 0) {
      await handleRepositoriesAdded(event.installation, event.repositories);
    }

    // Send welcome event
    await inngest.send({
      name: 'github.app.installed',
      data: {
        installation_id: event.installation.id,
        account: event.installation.account.login,
        repository_selection: event.installation.repository_selection,
        repository_count: event.repositories?.length || 0,
      },
    });

    // Track installation metrics
    await trackInstallationMetrics('installation_created', {
      account_type: event.installation.account.type,
      repository_selection: event.installation.repository_selection,
      repository_count: event.repositories?.length || 0,
    });
  } catch (error) {
    console.error('Error handling installation created:', error);
  }
}

/**
 * Handle installation deletion
 */
async function handleInstallationDeleted(event: InstallationEvent) {
  try {
    // Soft delete the installation
    await supabase
      .from('github_app_installations')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('installation_id', event.installation.id);

    // Track uninstall metrics
    await trackInstallationMetrics('installation_deleted', {
      account_type: event.installation.account.type,
      account_name: event.installation.account.login,
    });
  } catch (error) {
    console.error('Error handling installation deleted:', error);
  }
}

/**
 * Handle installation suspension
 */
async function handleInstallationSuspended(event: InstallationEvent) {
  try {
    await supabase
      .from('github_app_installations')
      .update({
        suspended_at: new Date().toISOString(),
      })
      .eq('installation_id', event.installation.id);
  } catch (error) {
    console.error('Error handling installation suspended:', error);
  }
}

/**
 * Handle installation unsuspension
 */
async function handleInstallationUnsuspended(event: InstallationEvent) {
  try {
    await supabase
      .from('github_app_installations')
      .update({
        suspended_at: null,
      })
      .eq('installation_id', event.installation.id);
  } catch (error) {
    console.error('Error handling installation unsuspended:', error);
  }
}

/**
 * Handle new permissions accepted
 */
async function handleNewPermissionsAccepted(event: InstallationEvent) {
  console.log('New permissions accepted for installation:', event.installation.id);

  // Could trigger re-sync of data with new permissions
  await inngest.send({
    name: 'github.app.permissions_updated',
    data: {
      installation_id: event.installation.id,
      account: event.installation.account.login,
    },
  });
}

/**
 * Handle repositories being added to an installation
 */
async function handleRepositoriesAdded(installation: any, repositories: any[]) {
  try {
    // Get the installation record
    const { data: installationRecord } = await supabase
      .from('github_app_installations')
      .select('id')
      .eq('installation_id', installation.id)
      .maybeSingle();

    if (!installationRecord) return;

    // Process each repository
    for (const repo of repositories) {
      // First, ensure the repository exists in our main repositories table
      const { data: existingRepo } = await supabase
        .from('repositories')
        .select('id')
        .eq('github_id', repo.id)
        .maybeSingle();

      let repoId = existingRepo?.id;

      if (!existingRepo) {
        // Create the repository if it doesn't exist
        const { data: newRepo } = await supabase
          .from('repositories')
          .insert({
            github_id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            // We'll need to fetch more details later
          })
          .select('id')
          .maybeSingle();

        repoId = newRepo?.id;
      }

      if (repoId) {
        // Link the repository to the installation
        await supabase.from('app_enabled_repositories').upsert({
          installation_id: installationRecord.id,
          repository_id: repoId,
          enabled_at: new Date().toISOString(),
        });

        // Queue for data sync
        await inngest.send({
          name: 'github.repository.app_enabled',
          data: {
            installation_id: installation.id,
            repository_id: repoId,
            repository_name: repo.full_name,
            is_private: repo.private,
          },
        });

        // Index git history and generate embeddings in the background
        try {
          const octokit = await githubAppAuth.getInstallationOctokit(installation.id);

          // Index git history
          // Ensure owner is properly set before calling indexGitHistory
          if (!repo.owner?.login) {
            repo.owner = {
              login: repo.full_name.split('/')[0],
              id: 0,
              type: 'User',
            };
          }
          indexGitHistory(repo, octokit).catch((error) => {
            console.error(`Failed to index git history for ${repo.full_name}:`, error);
          });

          // Generate embeddings for recent files
          octokit.repos
            .listCommits({
              owner: repo.owner?.login || repo.full_name.split('/')[0],
              repo: repo.name,
              per_page: 10,
            })
            .then(async ({ data: commits }) => {
              const files = new Set<string>();

              for (const commit of commits) {
                try {
                  const { data: commitData } = await octokit.repos.getCommit({
                    owner: repo.owner?.login || repo.full_name.split('/')[0],
                    repo: repo.name,
                    ref: commit.sha,
                  });

                  commitData.files?.forEach((file) => {
                    if (file.filename) {
                      files.add(file.filename);
                    }
                  });
                } catch (error) {
                  console.error(`Error fetching commit ${commit.sha}:`, error);
                }
              }

              if (files.size > 0) {
                generateFileEmbeddings(repo, octokit, Array.from(files)).catch((error) => {
                  console.error(`Failed to generate embeddings for ${repo.full_name}:`, error);
                });
              }
            })
            .catch((error) => {
              console.error(`Failed to fetch commits for ${repo.full_name}:`, error);
            });
        } catch (error) {
          console.error(`Failed to get octokit client for installation ${installation.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error handling repositories added:', error);
  }
}

/**
 * Handle repositories being removed from an installation
 */
async function handleRepositoriesRemoved(installation: any, repositories: any[]) {
  try {
    // Get the installation record
    const { data: installationRecord } = await supabase
      .from('github_app_installations')
      .select('id')
      .eq('installation_id', installation.id)
      .maybeSingle();

    if (!installationRecord) return;

    // Remove each repository
    for (const repo of repositories) {
      const { data: repoRecord } = await supabase
        .from('repositories')
        .select('id')
        .eq('github_id', repo.id)
        .maybeSingle();

      if (repoRecord) {
        await supabase
          .from('app_enabled_repositories')
          .delete()
          .eq('installation_id', installationRecord.id)
          .eq('repository_id', repoRecord.id);
      }
    }
  } catch (error) {
    console.error('Error handling repositories removed:', error);
  }
}

/**
 * Track installation metrics
 */
async function trackInstallationMetrics(event: string, data: any) {
  try {
    // In production, send to analytics service
    console.log('Installation metric:', event, data);

    // Could also store in database for dashboards
    await supabase.from('app_metrics').insert({
      event_type: event,
      event_data: data,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error tracking metrics:', error);
  }
}
