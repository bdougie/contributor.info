/**
 * Installation webhook handler
 * Handles GitHub App installation events
 */

import Logger from '../utils/logger.js';

export async function handleInstallationEvent(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('Installation') : new Logger('Installation');
  const { action, installation, repositories, sender } = payload;

  logger.info('Processing installation %s by %s', action, sender.login);
  logger.info('  Installation ID: %d', installation.id);
  logger.info('  Account: %s (%s)', installation.account.login, installation.account.type);

  try {
    switch (action) {
      case 'created':
        await handleNewInstallation(installation, repositories, supabase, logger);
        break;

      case 'deleted':
        await handleRemovedInstallation(installation, supabase, logger);
        break;

      case 'repositories_added':
        await handleRepositoriesAdded(installation, repositories, supabase, logger);
        break;

      case 'repositories_removed':
        await handleRepositoriesRemoved(installation, repositories, supabase, logger);
        break;

      default:
        logger.warn('Unhandled installation action: %s', action);
    }

    return { success: true };
  } catch (error) {
    logger.error('Error handling installation event: %s', error.message);
    throw error;
  }
}

async function handleNewInstallation(installation, repositories, supabase, logger) {
  logger.info('🎉 New installation for %s', installation.account.login);

  try {
    // Track the installation
    const { data: installData, error: installError } = await supabase.from('installations').upsert(
      {
        github_id: installation.id,
        account_login: installation.account.login,
        account_type: installation.account.type,
        account_id: installation.account.id,
        target_type: installation.target_type,
        created_at: installation.created_at,
        updated_at: installation.updated_at,
        permissions: installation.permissions,
        events: installation.events,
        repository_selection: installation.repository_selection,
      },
      {
        onConflict: 'github_id',
      }
    );

    if (installError) {
      logger.error('Error tracking installation: %s', installError.message);
    } else {
      logger.info('✅ Tracked installation %d', installation.id);
    }

    // Track repositories if provided
    if (repositories && repositories.length > 0) {
      for (const repo of repositories) {
        await trackRepository(repo, installation.id, supabase, logger);
      }
      logger.info('✅ Tracked %d repositories', repositories.length);
    }

    // Log summary
    logger.info(
      'Installation complete: account=%s type=%s repositories=%s permissions=%s',
      installation.account.login,
      installation.account.type,
      repositories?.length || 'all',
      Object.keys(installation.permissions || {}).join(', ')
    );
  } catch (error) {
    logger.error('Error handling new installation: %s', error.message);
  }
}

async function handleRemovedInstallation(installation, supabase, logger) {
  logger.info('❌ Installation removed for %s', installation.account.login);

  try {
    // Mark installation as deleted
    const { error } = await supabase
      .from('installations')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('github_id', installation.id);

    if (error) {
      logger.error('Error marking installation as deleted: %s', error.message);
    } else {
      logger.info('✅ Marked installation %d as deleted', installation.id);
    }
  } catch (error) {
    logger.error('Error handling removed installation: %s', error.message);
  }
}

async function handleRepositoriesAdded(installation, repositories, supabase, logger) {
  logger.info('➕ Adding %d repositories to installation %d', repositories.length, installation.id);

  try {
    for (const repo of repositories) {
      await trackRepository(repo, installation.id, supabase, logger);
    }
    logger.info('✅ Added %d repositories', repositories.length);
  } catch (error) {
    logger.error('Error adding repositories: %s', error.message);
  }
}

async function handleRepositoriesRemoved(installation, repositories, supabase, logger) {
  logger.info(
    '➖ Removing %d repositories from installation %d',
    repositories.length,
    installation.id
  );

  try {
    for (const repo of repositories) {
      // Mark repository as removed from installation
      const { error } = await supabase
        .from('installation_repositories')
        .update({
          removed_at: new Date().toISOString(),
        })
        .eq('repository_id', repo.id)
        .eq('installation_id', installation.id);

      if (error) {
        logger.error('Error removing repository %s: %s', repo.full_name, error.message);
      }
    }
    logger.info('✅ Removed %d repositories', repositories.length);
  } catch (error) {
    logger.error('Error removing repositories: %s', error.message);
  }
}

async function trackRepository(repo, installationId, supabase, logger) {
  try {
    // Track the repository
    await supabase.from('repositories').upsert(
      {
        github_id: repo.id,
        owner: repo.owner?.login || repo.full_name.split('/')[0],
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        is_private: repo.private,
        html_url: repo.html_url || `https://github.com/${repo.full_name}`,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      },
      {
        onConflict: 'github_id',
      }
    );

    // Track the installation-repository relationship
    await supabase.from('installation_repositories').upsert(
      {
        installation_id: installationId,
        repository_id: repo.id,
        added_at: new Date().toISOString(),
      },
      {
        onConflict: 'installation_id,repository_id',
      }
    );

    logger.info('  ✅ Tracked repository %s', repo.full_name);
  } catch (error) {
    logger.error('Error tracking repository %s: %s', repo.full_name, error.message);
  }
}
