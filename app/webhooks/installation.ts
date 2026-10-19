import { InstallationEvent, InstallationRepositoriesEvent, Installation } from '../types/github';
import { supabaseAdmin } from '../../src/lib/supabase-admin';

// Installation webhooks run server-side only (Netlify background function), where there
// is no user session. Writes to github_app_installations / app_enabled_repositories
// / repositories are blocked by RLS for the anon role, so use the service-role
// admin client (RLS bypass). supabaseAdmin is always initialized server-side.
const supabase = supabaseAdmin!;

interface RepositoryBasic {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner?: {
    login: string;
  };
}

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
    const { error } = await supabase
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

    // The former `github.app.installed` Inngest event had no consumer; the
    // metrics row below is the record of the install.
    console.log(
      'App installed for %s (%s, %d repos)',
      event.installation.account.login,
      event.installation.repository_selection,
      event.repositories?.length || 0
    );

    // Track installation metrics
    await trackInstallationMetrics('installation_created', {
      account_type: event.installation.account.type,
      repository_selection: event.installation.repository_selection,
      repository_count: event.repositories?.length || 0,
    });
  } catch (error) {
    console.error('Error handling installation created:', error);
    // Re-throw so the webhook receiver records the delivery as failed and a
    // GitHub "Redeliver" retries it instead of being skipped as a duplicate.
    throw error;
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

    // Private repos covered by this installation lose their only sync
    // token — stop tracking them
    const { data: installationRecord } = await supabase
      .from('github_app_installations')
      .select('id')
      .eq('installation_id', event.installation.id)
      .maybeSingle();

    if (installationRecord) {
      const { data: enabledRepos } = await supabase
        .from('app_enabled_repositories')
        .select('repository_id, repositories!inner(id, is_private)')
        .eq('installation_id', installationRecord.id);

      const privateRepoIds = (enabledRepos || [])
        .filter((row) => {
          const repo = Array.isArray(row.repositories) ? row.repositories[0] : row.repositories;
          return repo?.is_private;
        })
        .map((row) => row.repository_id);

      if (privateRepoIds.length > 0) {
        await supabase
          .from('tracked_repositories')
          .update({ tracking_enabled: false, updated_at: new Date().toISOString() })
          .in('repository_id', privateRepoIds);
      }
    }

    // Track uninstall metrics
    await trackInstallationMetrics('installation_deleted', {
      account_type: event.installation.account.type,
      account_name: event.installation.account.login,
    });
  } catch (error) {
    console.error('Error handling installation deleted:', error);
    throw error;
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
    throw error;
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
    throw error;
  }
}

/**
 * Handle new permissions accepted
 */
async function handleNewPermissionsAccepted(event: InstallationEvent) {
  console.log('New permissions accepted for installation:', event.installation.id);

  // The former `github.app.permissions_updated` Inngest event had no consumer.
  // A re-sync with the new permissions happens on the next scheduled sync.
}

/**
 * Handle repositories being added to an installation
 */
async function handleRepositoriesAdded(
  installation: Installation,
  repositories: RepositoryBasic[]
) {
  try {
    // Get the installation record
    let { data: installationRecord } = await supabase
      .from('github_app_installations')
      .select('id')
      .eq('installation_id', installation.id)
      .maybeSingle();

    // Self-heal: the installation row can be missing if installation.created was
    // never recorded (e.g. it fired before this webhook handler was deployed).
    // Recreate it from the installation payload so repository additions aren't
    // silently dropped for pre-existing installations.
    if (!installationRecord) {
      const { data: backfilled, error: backfillError } = await supabase
        .from('github_app_installations')
        .upsert({
          installation_id: installation.id,
          account_type: installation.account.type.toLowerCase(),
          account_name: installation.account.login,
          account_id: installation.account.id,
          repository_selection: installation.repository_selection,
          installed_at: new Date().toISOString(),
          settings: {
            enabled: true,
            comment_on_prs: true,
            include_issue_context: true,
            comment_style: 'detailed',
          },
        })
        .select('id')
        .maybeSingle();

      if (backfillError) {
        console.error('Failed to backfill installation record:', backfillError);
        return;
      }
      installationRecord = backfilled;
    }

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
        const { data: newRepo, error: repoInsertError } = await supabase
          .from('repositories')
          .insert({
            github_id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: repo.owner?.login || repo.full_name.split('/')[0],
            is_private: repo.private,
            // We'll need to fetch more details later
          })
          .select('id')
          .maybeSingle();

        if (repoInsertError) {
          console.error(`Failed to insert repository ${repo.full_name}:`, repoInsertError);
        }

        repoId = newRepo?.id;
      }

      if (repoId) {
        // Link the repository to the installation
        await supabase.from('app_enabled_repositories').upsert({
          installation_id: installationRecord.id,
          repository_id: repoId,
          enabled_at: new Date().toISOString(),
        });

        // Enable webhook priority for this repository
        await supabase
          .from('repositories')
          .update({
            webhook_priority: true,
            webhook_enabled_at: new Date().toISOString(),
          })
          .eq('id', repoId);

        // The former `github.repository.app_enabled` Inngest event had no
        // consumer. Data sync is picked up by the scheduled sync; the
        // `webhook_priority` flag above is what marks the repo as app-enabled.
        console.log(
          'App enabled for %s (installation %d, private=%s)',
          repo.full_name,
          installation.id,
          String(repo.private)
        );

        // Git-history indexing and file embeddings used to run here. Their
        // tables (file_contributors, file_embeddings) were dropped on
        // 2026-04-28 (20260428000007_drop_dead_tables.sql), so that work was
        // only producing errors; removed with the Inngest migration.
      }
    }
  } catch (error) {
    console.error('Error handling repositories added:', error);
    throw error;
  }
}

/**
 * Handle repositories being removed from an installation
 */
async function handleRepositoriesRemoved(
  installation: Installation,
  repositories: RepositoryBasic[]
) {
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
        .select('id, is_private')
        .eq('github_id', repo.id)
        .maybeSingle();

      if (repoRecord) {
        await supabase
          .from('app_enabled_repositories')
          .delete()
          .eq('installation_id', installationRecord.id)
          .eq('repository_id', repoRecord.id);

        // Disable webhook priority for this repository
        await supabase
          .from('repositories')
          .update({
            webhook_priority: false,
            webhook_enabled_at: null,
            last_webhook_event_at: null,
          })
          .eq('id', repoRecord.id);

        // Private repos are only accessible through the installation —
        // once it's gone, sync has no token, so stop tracking them
        if (repoRecord.is_private || repo.private) {
          await supabase
            .from('tracked_repositories')
            .update({ tracking_enabled: false, updated_at: new Date().toISOString() })
            .eq('repository_id', repoRecord.id);
        }
      }
    }
  } catch (error) {
    console.error('Error handling repositories removed:', error);
  }
}

/**
 * Track installation metrics
 */
async function trackInstallationMetrics(event: string, data: Record<string, unknown>) {
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
