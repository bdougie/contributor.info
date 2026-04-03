import { supabase } from '../../src/lib/supabase';
import type { GitHubAppAuth } from '../lib/auth';
import { createLogger } from '../services/logger';

const logger = createLogger('labeled');

// Lazy load auth to avoid initialization errors
let githubAppAuth: GitHubAppAuth | null = null;

async function getAuth() {
  if (!githubAppAuth) {
    try {
      const { githubAppAuth: auth } = await import('../lib/auth');
      githubAppAuth = auth;
      logger.info('GitHub App auth loaded for labeled handler');
    } catch (error) {
      logger.error('Failed to load GitHub App auth:', error);
      throw error;
    }
  }
  return githubAppAuth;
}

interface LabeledEvent {
  action: 'labeled' | 'unlabeled';
  label: {
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description: string | null;
  };
  issue?: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
      id: number;
    };
    state: string;
    html_url: string;
  };
  pull_request?: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
      id: number;
    };
    state: string;
    html_url: string;
  };
  repository: {
    id: number;
    full_name: string;
    name: string;
    owner: {
      login: string;
      id: number;
    };
  };
  installation?: {
    id: number;
  };
  sender: {
    login: string;
    id: number;
  };
}

/**
 * Handle labeled events for both issues and pull requests
 * Specifically looks for the 'contributor.info' label
 * Only responds to 'labeled' action, not 'unlabeled'
 */
export async function handleLabeledEvent(event: LabeledEvent) {
  logger.info('handleLabeledEvent called');

  try {
    // Only process 'labeled' action (not 'unlabeled')
    if (event.action !== 'labeled') {
      logger.info('Skipping %s event - only responding to labeled actions', event.action);
      return;
    }

    logger.info('Label event: %s', event.label.name);

    // Check if the label is 'contributor.info'
    if (event.label.name !== 'contributor.info') {
      logger.info('Label %s is not contributor.info, skipping', event.label.name);
      return;
    }

    const item = event.issue || event.pull_request;
    const itemType = event.issue ? 'issue' : 'pull_request';

    if (!item) {
      logger.error('No issue or pull_request in labeled event');
      return;
    }

    logger.info(
      'contributor.info label added to %s #%d in %s',
      itemType,
      item.number,
      event.repository.full_name
    );

    // Get installation token if available
    const installationId = event.installation?.id;
    if (!installationId) {
      logger.error('No installation ID, cannot post comment');
      return;
    }

    logger.info('Getting auth module...');
    const auth = await getAuth();

    logger.info('Getting installation Octokit...');
    const octokit = await auth.getInstallationOctokit(installationId);
    logger.info('Got installation Octokit');

    // Track the repository in our database
    await ensureRepositoryTracked(event.repository);

    // Post a comment acknowledging the label
    const comment = formatLabeledComment(itemType, item, event.repository);

    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: item.number,
      body: comment,
    });

    logger.info(
      'Posted label acknowledgment comment %d on %s #%d',
      postedComment.id,
      itemType,
      item.number
    );

    // Queue for data processing
    await queueForProcessing(itemType, item, event.repository);
  } catch (error) {
    logger.error('Error handling labeled event:', error);
  }
}

/**
 * Format a comment for when the contributor.info label is added
 */
function formatLabeledComment(
  itemType: string,
  item: LabeledEvent['issue'] | LabeledEvent['pull_request'],
  repository: LabeledEvent['repository']
): string {
  const emoji = itemType === 'issue' ? '🎯' : '🚀';
  const typeLabel = itemType === 'issue' ? 'Issue' : 'PR';

  let comment = `## ${emoji} ${typeLabel} Tracked!\n\n`;
  comment += `Thanks for labeling this with \`contributor.info\`! `;
  comment += `I'm now tracking **${typeLabel} #${item.number}** in the contributor.info dashboard.\n\n`;

  comment += `### What happens next?\n`;
  comment += `- 📊 This ${typeLabel.toLowerCase()} will be analyzed for contributor insights\n`;
  comment += `- 🔍 Similar ${itemType === 'issue' ? 'issues' : 'pull requests'} will be identified\n`;
  comment += `- 👥 Relevant contributors and reviewers will be suggested\n`;
  comment += `- 📈 Activity will be tracked in the [contributor.info dashboard](https://contributor.info/${repository.owner.login}/${repository.name})\n\n`;

  comment += `_Repository **${repository.full_name}** is now being monitored for contributor activity._ `;
  comment += `_Powered by [contributor.info](https://contributor.info)_ 🤖`;

  return comment;
}

/**
 * Ensure repository is tracked in database
 */
async function ensureRepositoryTracked(repo: LabeledEvent['repository']): Promise<string | null> {
  try {
    // Check if repository exists
    const { data: existing } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repo.id)
      .maybeSingle();

    if (existing) {
      logger.info('Repository %s already tracked', repo.full_name);
      return existing.id;
    }

    // Create new repository entry
    logger.info('Adding repository %s to tracking', repo.full_name);

    const { data: newRepo, error } = await supabase
      .from('repositories')
      .insert({
        github_id: repo.id,
        full_name: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        is_tracked: true,
        tracking_started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to create repository: %s', error.message);
      return null;
    }

    logger.info('Repository %s added to tracking', repo.full_name);
    return newRepo.id;
  } catch (error) {
    logger.error('Error ensuring repository tracked:', error);
    return null;
  }
}

/**
 * Queue the item for background processing
 */
async function queueForProcessing(
  itemType: string,
  item: LabeledEvent['issue'] | LabeledEvent['pull_request'],
  repository: LabeledEvent['repository']
) {
  try {
    // Store the item metadata for processing
    const metadata = {
      type: itemType,
      number: item.number,
      title: item.title,
      repository: repository.full_name,
      github_id: item.id,
      labeled_at: new Date().toISOString(),
    };

    logger.info('Queued %s #%d for processing:', itemType, item.number, metadata);

    // Could trigger an Inngest job or other background processing here
    // For now, just log the action
  } catch (error) {
    logger.error('Error queuing for processing:', error);
  }
}
