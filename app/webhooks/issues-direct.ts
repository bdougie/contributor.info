import { IssuesEvent } from '../types/github';
import { supabase } from '../../src/lib/supabase';

// Lazy load auth to avoid initialization errors
let githubAppAuth: any = null;

async function getAuth() {
  if (!githubAppAuth) {
    try {
      const { githubAppAuth: auth } = await import('../lib/auth');
      githubAppAuth = auth;
      console.log('✅ GitHub App auth loaded for issues handler');
    } catch (error) {
      console.error('❌ Failed to load GitHub App auth:', error);
      throw error;
    }
  }
  return githubAppAuth;
}

/**
 * Direct webhook handler for issue.opened events
 * Works without requiring the repository to be in the database
 */
export async function handleIssueOpenedDirect(event: IssuesEvent) {
  console.log('🎯 handleIssueOpenedDirect called');
  
  try {
    const { issue, repository, installation } = event;
    
    console.log(`Processing opened issue #${issue.number} in ${repository.full_name}`);
    console.log(`  Repository GitHub ID: ${repository.id}`);
    console.log(`  Installation ID: ${installation?.id}`);
    console.log(`  Issue author: ${issue.user.login}`);

    // Get installation token
    const installationId = installation?.id;
    if (!installationId) {
      console.log('❌ No installation ID found, cannot post comment');
      return;
    }

    console.log('📝 Getting auth module...');
    const auth = await getAuth();
    
    console.log('📝 Getting installation Octokit...');
    const octokit = await auth.getInstallationOctokit(installationId);
    console.log('✅ Got installation Octokit');

    // Find similar issues using direct repository info
    const similarIssues = await findSimilarIssuesDirect(issue, repository);

    // Format welcome comment
    let comment = formatIssueWelcomeComment(issue, repository, similarIssues);

    // Post the comment
    const { data: postedComment } = await octokit.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: issue.number,
      body: comment,
    });

    console.log(`✅ Posted welcome comment ${postedComment.id} on issue #${issue.number}`);
    console.log(`  - Similar issues found: ${similarIssues.length}`);

    // Ensure repository is tracked for future use
    await ensureRepositoryTracked(repository);

  } catch (error) {
    console.error('Error handling issue opened event:', error);
  }
}

/**
 * Format a welcome comment for new issues
 */
function formatIssueWelcomeComment(issue: any, repository: any, similarIssues: any[]): string {
  let comment = `## 👋 Welcome!\n\n`;
  comment += `Thanks for opening this issue in **${repository.full_name}**! `;
  comment += `I'm here to help connect your issue with relevant information.\n\n`;

  // Add similar issues if found
  if (similarIssues.length > 0) {
    comment += `### 🔗 Related Issues\n\n`;
    comment += `I found some issues that might be related:\n\n`;
    
    for (const similar of similarIssues) {
      const stateEmoji = similar.state === 'open' ? '🟢' : '🔴';
      comment += `- ${stateEmoji} [#${similar.number} - ${similar.title}](${similar.html_url})`;
      
      if (similar.similarity_reason) {
        comment += ` (${similar.similarity_reason})`;
      }
      comment += '\n';
    }
    
    comment += '\n';
  }

  // Add tracking info
  comment += `### 📊 What's Next?\n\n`;
  comment += `- Your issue is now being tracked for contributor insights\n`;
  comment += `- Relevant contributors will be notified based on their expertise\n`;
  comment += `- Activity updates will appear in the [contributor dashboard](https://contributor.info/${repository.owner.login}/${repository.name})\n\n`;

  comment += `_Need faster help? Consider adding the \`contributor.info\` label to prioritize this issue._ `;
  comment += `_Powered by [contributor.info](https://contributor.info)_ 🤖`;

  return comment;
}

/**
 * Find similar issues using repository info directly
 */
async function findSimilarIssuesDirect(issue: any, repository: any): Promise<any[]> {
  try {
    // Check if repository is in database
    const { data: dbRepo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repository.id)
      .maybeSingle();
    
    if (!dbRepo) {
      console.log('Repository not in database yet, no similar issues available');
      return [];
    }
    
    // Look for similar issues
    const { data: issues } = await supabase
      .from('issues')
      .select('*')
      .eq('repository_id', dbRepo.id)
      .neq('number', issue.number) // Exclude the current issue
      .limit(50);
    
    if (!issues || issues.length === 0) {
      return [];
    }
    
    // Simple similarity matching
    const similar = [];
    const issueTitleLower = issue.title.toLowerCase();
    const issueBodyLower = (issue.body || '').toLowerCase();
    
    for (const existingIssue of issues) {
      const titleLower = (existingIssue.title || '').toLowerCase();
      const bodyLower = (existingIssue.body || '').toLowerCase();
      
      let similarityScore = 0;
      let similarity_reason = null;
      
      // Check for similar titles
      const titleWords = issueTitleLower.split(/\s+/).filter(w => w.length > 3);
      const existingTitleWords = titleLower.split(/\s+/).filter(w => w.length > 3);
      const commonWords = titleWords.filter(word => existingTitleWords.includes(word));
      
      if (commonWords.length >= 3) {
        similarityScore = commonWords.length / Math.max(titleWords.length, existingTitleWords.length);
        similarity_reason = 'similar title';
      }
      
      // Check for common error messages or keywords
      const errorPatterns = [
        /error:\s*(.+)/i,
        /exception:\s*(.+)/i,
        /failed to\s+(.+)/i,
        /cannot\s+(.+)/i,
        /unable to\s+(.+)/i,
      ];
      
      for (const pattern of errorPatterns) {
        const issueMatch = issueBodyLower.match(pattern);
        const existingMatch = bodyLower.match(pattern);
        
        if (issueMatch && existingMatch && issueMatch[1] === existingMatch[1]) {
          similarityScore = 0.8;
          similarity_reason = 'same error message';
          break;
        }
      }
      
      if (similarityScore > 0.4) {
        similar.push({
          ...existingIssue,
          similarityScore,
          similarity_reason,
        });
      }
    }
    
    // Sort by similarity and return top 3
    return similar
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 3);
    
  } catch (error) {
    console.error('Error finding similar issues:', error);
    return [];
  }
}

/**
 * Ensure repository is tracked in database
 */
async function ensureRepositoryTracked(repository: any) {
  try {
    // Check if repository exists with correct GitHub ID
    const { data: existing } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('github_id', repository.id)
      .maybeSingle();
    
    if (existing) {
      console.log(`Repository ${repository.full_name} already tracked`);
      return existing.id;
    }
    
    // Check if repository exists with wrong GitHub ID
    const { data: wrongId } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('owner', repository.owner.login)
      .eq('name', repository.name)
      .maybeSingle();
    
    if (wrongId) {
      console.log(`⚠️ Repository ${repository.full_name} has wrong GitHub ID: ${wrongId.github_id} vs ${repository.id}`);
      
      // Update with correct GitHub ID
      const { error: updateError } = await supabase
        .from('repositories')
        .update({ 
          github_id: repository.id,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', wrongId.id);
      
      if (!updateError) {
        console.log(`✅ Fixed GitHub ID for ${repository.full_name}`);
      }
      return wrongId.id;
    }
    
    // Repository doesn't exist, create it
    console.log(`Adding new repository ${repository.full_name} to database`);
    
    const { data: newRepo, error } = await supabase
      .from('repositories')
      .insert({
        github_id: repository.id,
        full_name: repository.full_name,
        owner: repository.owner.login,
        name: repository.name,
        description: repository.description,
        language: repository.language,
        stargazers_count: repository.stargazers_count || 0,
        forks_count: repository.forks_count || 0,
        open_issues_count: repository.open_issues_count || 0,
        is_private: repository.private || false,
        default_branch: repository.default_branch || 'main',
        is_tracked: true,
        tracking_started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    
    if (error) {
      console.error(`Failed to create repository: ${error.message}`);
      return null;
    }
    
    console.log(`✅ Created repository ${repository.full_name} with GitHub ID ${repository.id}`);
    return newRepo.id;
    
  } catch (error) {
    console.error('Error ensuring repository tracked:', error);
    return null;
  }
}