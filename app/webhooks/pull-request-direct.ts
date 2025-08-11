import { PullRequestEvent } from '../types/github';
import { formatMinimalPRComment } from '../services/comments';
import { suggestReviewers } from '../services/reviewers';
import { 
  fetchContributorConfig, 
  isFeatureEnabled,
  isUserExcluded
} from '../services/contributor-config';
import { supabase } from '../../src/lib/supabase';

// Lazy load auth to avoid initialization errors
let githubAppAuth: any = null;

async function getAuth() {
  if (!githubAppAuth) {
    try {
      const { githubAppAuth: auth } = await import('../lib/auth');
      githubAppAuth = auth;
      console.log('✅ GitHub App auth loaded');
    } catch (error) {
      console.error('❌ Failed to load GitHub App auth:', error);
      throw error;
    }
  }
  return githubAppAuth;
}

/**
 * Direct webhook handler that uses repository info from webhook payload
 * instead of requiring database lookup. This ensures comments work even
 * if the repository isn't tracked in our database yet.
 */
export async function handlePROpenedDirect(event: PullRequestEvent) {
  console.log('🚀 handlePROpenedDirect called');
  
  try {
    const { pull_request: pr, repository: repo, installation } = event;
    
    console.log(`Processing opened PR #${pr.number} in ${repo.full_name}`);
    console.log(`  Repository GitHub ID from webhook: ${repo.id}`);
    console.log(`  Installation ID: ${installation?.id}`);
    console.log(`  PR author: ${pr.user.login}`);

    // Get installation token
    const installationId = installation?.id;
    if (!installationId) {
      console.error('❌ No installation ID found in webhook payload');
      return;
    }

    console.log('📝 Getting auth module...');
    const auth = await getAuth();
    
    console.log('📝 Getting installation Octokit...');
    const octokit = await auth.getInstallationOctokit(installationId);
    console.log('✅ Got installation Octokit');

    // Fetch configuration from the repository
    const config = await fetchContributorConfig(
      octokit,
      repo.owner.login,
      repo.name
    );

    // Check if PR author is excluded
    if (isUserExcluded(config, pr.user.login, 'author')) {
      console.log(`PR author ${pr.user.login} is excluded from comments`);
      return;
    }

    // Check if auto-comment is enabled
    if (!isFeatureEnabled(config, 'auto_comment')) {
      console.log('Auto-comment is disabled in .contributor config');
      return;
    }

    // Gather insights based on configuration
    const promises = [];
    
    // Get similar issues if enabled (this will work with direct repo info)
    if (isFeatureEnabled(config, 'similar_issues')) {
      promises.push(findSimilarIssuesDirect(pr, repo));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    // Get reviewer suggestions if enabled
    if (isFeatureEnabled(config, 'reviewer_suggestions')) {
      promises.push(suggestReviewers(pr, repo, installationId));
    } else {
      promises.push(Promise.resolve({ suggestions: [], hasCodeOwners: false }));
    }
    
    const [similarIssues, reviewerSuggestionsResult] = await Promise.all(promises);
    
    // Extract and filter suggestions
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = (reviewerSuggestionsResult?.suggestions || []).filter(
      reviewer => !isUserExcluded(config, reviewer.login, 'reviewer')
    );
    
    // Only post if we have something to share
    if (similarIssues.length === 0 && reviewerSuggestions.length === 0) {
      console.log('No similar issues or reviewer suggestions found');
      
      // Optionally store the repository info for future use
      await ensureRepositoryTracked(repo);
      return;
    }
    
    // Format the comment
    let comment = '';
    
    // Add similar issues section if found
    if (similarIssues.length > 0) {
      comment += '## 🔗 Related Issues\n\n';
      comment += 'I found the following issues that may be related to this PR:\n\n';
      
      for (const similar of similarIssues) {
        const stateEmoji = similar.issue.state === 'open' ? '🟢' : '🔴';
        const relationshipEmoji = similar.relationship === 'fixes' ? '🔧' : 
                                similar.relationship === 'implements' ? '⚡' :
                                similar.relationship === 'relates_to' ? '🔗' : '💭';
        
        comment += `- ${stateEmoji} ${relationshipEmoji} [#${similar.issue.number} - ${similar.issue.title}](${similar.issue.html_url}) `;
        
        if (similar.reasons.length > 0) {
          comment += `(${similar.reasons.join(', ')})\n`;
        } else {
          comment += `(${Math.round(similar.similarityScore * 100)}% similar)\n`;
        }
      }
      
      comment += '\n';
    }
    
    // Add reviewer suggestions section if found
    if (reviewerSuggestions.length > 0) {
      comment += '## 👥 Suggested Reviewers\n\n';
      
      if (hasCodeOwners) {
        comment += '_Based on CODEOWNERS and contribution history:_\n\n';
      } else {
        comment += '_Based on contribution history:_\n\n';
      }
      
      for (const reviewer of reviewerSuggestions.slice(0, 3)) {
        comment += `- **@${reviewer.login}** - `;
        
        if (reviewer.reasons.length > 0) {
          comment += reviewer.reasons.join(', ');
        } else {
          comment += `${reviewer.contributions} contributions`;
        }
        
        if (reviewer.lastActive) {
          const daysAgo = Math.floor((Date.now() - new Date(reviewer.lastActive).getTime()) / (1000 * 60 * 60 * 24));
          if (daysAgo < 30) {
            comment += ` (active ${daysAgo === 0 ? 'today' : `${daysAgo} days ago`})`;
          }
        }
        
        comment += '\n';
      }
      
      comment += '\n';
    }
    
    // Add footer
    comment += '_This helps connect related work and find the right reviewers. ';
    comment += 'Powered by [contributor.info](https://contributor.info)_ 🤖';
    
    // Post the comment using repository info from webhook
    const { data: postedComment } = await octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pr.number,
      body: comment,
    });
    
    console.log(`✅ Posted comment ${postedComment.id} on PR #${pr.number}`);
    console.log(`  - Similar issues: ${similarIssues.length}`);
    console.log(`  - Reviewer suggestions: ${reviewerSuggestions.length}`);
    
    // Store the repository for future use if not already tracked
    await ensureRepositoryTracked(repo);
    
    // Optionally store comment tracking info
    await trackWebhookComment({
      pullRequest: pr,
      repository: repo,
      similarIssues,
      reviewerSuggestions,
      commentId: postedComment.id,
    });

  } catch (error) {
    console.error('Error handling PR opened event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Find similar issues using repository info directly from webhook
 */
async function findSimilarIssuesDirect(pr: any, repo: any): Promise<any[]> {
  try {
    // First check if repository is in database
    const { data: dbRepo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repo.id)
      .maybeSingle();
    
    if (!dbRepo) {
      console.log('Repository not in database, no similar issues available');
      return [];
    }
    
    // Now we can look for similar issues
    const { data: issues } = await supabase
      .from('issues')
      .select('*')
      .eq('repository_id', dbRepo.id)
      .limit(100);
    
    if (!issues || issues.length === 0) {
      console.log('No issues found in database for similarity matching');
      return [];
    }
    
    // Simple similarity matching (can be enhanced)
    const similar = [];
    const prTitleLower = pr.title.toLowerCase();
    const prBodyLower = (pr.body || '').toLowerCase();
    
    for (const issue of issues) {
      const titleLower = (issue.title || '').toLowerCase();
      const bodyLower = (issue.body || '').toLowerCase();
      
      // Check for keyword matches
      const reasons = [];
      let similarityScore = 0;
      
      // Check if PR mentions the issue number
      if (pr.body && pr.body.includes(`#${issue.number}`)) {
        reasons.push(`mentioned in PR`);
        similarityScore = 1.0;
      }
      
      // Check for similar titles
      const titleWords = prTitleLower.split(/\s+/);
      const issueTitleWords = titleLower.split(/\s+/);
      const commonWords = titleWords.filter(word => 
        word.length > 3 && issueTitleWords.includes(word)
      );
      
      if (commonWords.length > 2) {
        similarityScore = Math.max(similarityScore, commonWords.length / titleWords.length);
        if (similarityScore > 0.5) {
          reasons.push('similar title');
        }
      }
      
      if (similarityScore > 0.3 || reasons.length > 0) {
        similar.push({
          issue: {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            html_url: issue.html_url,
          },
          similarityScore,
          reasons,
          relationship: reasons.includes('mentioned in PR') ? 'fixes' : 'relates_to',
        });
      }
    }
    
    // Sort by similarity score and return top 5
    return similar
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 5);
    
  } catch (error) {
    console.error('Error finding similar issues:', error);
    return [];
  }
}

/**
 * Ensure repository is tracked in database with correct GitHub ID
 */
async function ensureRepositoryTracked(repo: any) {
  try {
    // Check if repository exists with correct GitHub ID
    const { data: existing } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('github_id', repo.id)
      .maybeSingle();
    
    if (existing) {
      console.log(`Repository ${repo.full_name} already tracked with correct GitHub ID`);
      return existing.id;
    }
    
    // Check if repository exists with wrong GitHub ID (by owner/name)
    const { data: wrongId } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('owner', repo.owner.login)
      .eq('name', repo.name)
      .maybeSingle();
    
    if (wrongId) {
      console.log(`⚠️ Repository ${repo.full_name} has wrong GitHub ID: ${wrongId.github_id} vs ${repo.id}`);
      
      // Update with correct GitHub ID
      const { error: updateError } = await supabase
        .from('repositories')
        .update({ 
          github_id: repo.id,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', wrongId.id);
      
      if (!updateError) {
        console.log(`✅ Fixed GitHub ID for ${repo.full_name}`);
      }
      return wrongId.id;
    }
    
    // Repository doesn't exist, create it
    console.log(`Adding new repository ${repo.full_name} to database`);
    
    const { data: newRepo, error } = await supabase
      .from('repositories')
      .insert({
        github_id: repo.id,
        full_name: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
        open_issues_count: repo.open_issues_count || 0,
        is_private: repo.private || false,
        default_branch: repo.default_branch || 'main',
        github_created_at: repo.created_at,
        github_updated_at: repo.updated_at,
      })
      .select('id')
      .maybeSingle();
    
    if (error) {
      console.error(`Failed to create repository: ${error.message}`);
      return null;
    }
    
    console.log(`✅ Created repository ${repo.full_name} with GitHub ID ${repo.id}`);
    return newRepo.id;
    
  } catch (error) {
    console.error('Error ensuring repository tracked:', error);
    return null;
  }
}

/**
 * Track webhook comment for analytics
 */
async function trackWebhookComment(data: {
  pullRequest: any;
  repository: any;
  similarIssues: any[];
  reviewerSuggestions: any[];
  commentId: number;
}) {
  try {
    // Store webhook activity for analytics
    await supabase
      .from('webhook_activities')
      .insert({
        event_type: 'pull_request.opened',
        repository_github_id: data.repository.id,
        repository_name: data.repository.full_name,
        pr_number: data.pullRequest.number,
        comment_posted: true,
        comment_id: data.commentId,
        similar_issues_count: data.similarIssues.length,
        reviewer_suggestions_count: data.reviewerSuggestions.length,
        created_at: new Date().toISOString(),
      });
    
  } catch (error) {
    // Non-critical, just log
    console.log('Could not track webhook activity:', error.message);
  }
}