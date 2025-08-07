import { supabase } from '../../src/lib/supabase';

// Lazy load auth to avoid initialization errors
let githubAppAuth: any = null;

async function getAuth() {
  if (!githubAppAuth) {
    try {
      const { githubAppAuth: auth } = await import('../lib/auth');
      githubAppAuth = auth;
      console.log('✅ GitHub App auth loaded for labeled handler');
    } catch (error) {
      console.error('❌ Failed to load GitHub App auth:', error);
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
  console.log('🏷️ handleLabeledEvent called');
  
  try {
    // Only process 'labeled' action (not 'unlabeled')
    if (event.action !== 'labeled') {
      console.log(`Skipping ${event.action} event - only responding to 'labeled' actions`);
      return;
    }

    console.log(`Label event: ${event.label.name}`);
    
    // Check if the label is 'contributor.info'
    if (event.label.name !== 'contributor.info') {
      console.log(`Label '${event.label.name}' is not 'contributor.info', skipping`);
      return;
    }

    const item = event.issue || event.pull_request;
    const itemType = event.issue ? 'issue' : 'pull_request';
    
    if (!item) {
      console.error('❌ No issue or pull_request in labeled event');
      return;
    }

    console.log(`✅ 'contributor.info' label added to ${itemType} #${item.number} in ${event.repository.full_name}`);

    // Get installation token if available
    const installationId = event.installation?.id;
    if (!installationId) {
      console.log('❌ No installation ID, cannot post comment');
      return;
    }

    console.log('📝 Getting auth module...');
    const auth = await getAuth();
    
    console.log('📝 Getting installation Octokit...');
    const octokit = await auth.getInstallationOctokit(installationId);
    console.log('✅ Got installation Octokit');

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

    console.log(`✅ Posted label acknowledgment comment ${postedComment.id} on ${itemType} #${item.number}`);

    // Queue for data processing
    await queueForProcessing(itemType, item, event.repository);

  } catch (error) {
    console.error('Error handling labeled event:', error);
  }
}

/**
 * Format a comment for when the contributor.info label is added
 */
function formatLabeledComment(itemType: string, item: any, repository: any): string {
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
async function ensureRepositoryTracked(repo: any) {
  try {
    // Check if repository exists
    const { data: existing } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repo.id)
      .single();
    
    if (existing) {
      console.log(`Repository ${repo.full_name} already tracked`);
      return existing.id;
    }
    
    // Create new repository entry
    console.log(`Adding repository ${repo.full_name} to tracking`);
    
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
      .single();
    
    if (error) {
      console.error(`Failed to create repository: ${error.message}`);
      return null;
    }
    
    console.log(`✅ Repository ${repo.full_name} added to tracking`);
    return newRepo.id;
    
  } catch (error) {
    console.error('Error ensuring repository tracked:', error);
    return null;
  }
}

/**
 * Queue the item for background processing
 */
async function queueForProcessing(itemType: string, item: any, repository: any) {
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

    console.log(`Queued ${itemType} #${item.number} for processing:`, metadata);

    // Could trigger an Inngest job or other background processing here
    // For now, just log the action
    
  } catch (error) {
    console.error('Error queuing for processing:', error);
  }
}