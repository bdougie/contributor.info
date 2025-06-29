import { SpamDetectionService } from '../../../src/lib/spam/SpamDetectionService.ts';
import { PullRequestData, SpamDetectionResult } from '../../../src/lib/spam/types.ts';

// Singleton instance for performance
let spamServiceInstance: SpamDetectionService | null = null;

function getSpamService(): SpamDetectionService {
  if (!spamServiceInstance) {
    spamServiceInstance = new SpamDetectionService();
  }
  return spamServiceInstance;
}

// Convert GitHub API PR data to our PullRequestData format
export function convertGitHubPRToSpamData(pr: any, author: any): PullRequestData {
  return {
    id: pr.id.toString(),
    title: pr.title,
    body: pr.body || '',
    number: pr.number,
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changed_files: pr.changed_files || 0,
    created_at: pr.created_at,
    html_url: pr.html_url,
    author: {
      id: author.id,
      login: author.login,
      created_at: author.created_at,
      public_repos: author.public_repos,
      followers: author.followers,
      following: author.following,
      bio: author.bio,
      company: author.company,
      location: author.location,
    },
    repository: {
      full_name: `${pr.base?.repo?.full_name || 'unknown/unknown'}`,
    },
  };
}

// Process PR with spam detection
export async function processPRWithSpamDetection(
  supabase: any,
  pr: any,
  repositoryId: string,
  spamService?: SpamDetectionService
): Promise<{ success: boolean; spamResult?: SpamDetectionResult; error?: string }> {
  const startTime = Date.now();
  const author = pr.user;
  
  try {
    // First ensure the contributor exists
    const { data: contributor, error: contributorError } = await supabase
      .from('contributors')
      .upsert({
        github_id: author.id,
        username: author.login,
        display_name: author.login,
        avatar_url: author.avatar_url,
        profile_url: author.html_url,
        is_bot: author.type === 'Bot',
        first_seen_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (contributorError) {
      console.error(`[Spam Detection] Error upserting contributor ${author.login}:`, contributorError)
      return { success: false, error: contributorError.message };
    }
    
    // Convert PR data for spam detection
    const prData = convertGitHubPRToSpamData(pr, author);
    
    // Run spam detection (use singleton if not provided)
    const service = spamService || getSpamService();
    const spamResult = await service.detectSpam(prData);
    
    // Log performance warning if too slow
    const detectionTime = Date.now() - startTime;
    if (detectionTime > 100) {
      console.warn(`[Spam Detection] Slow detection for PR #${pr.number}: ${detectionTime}ms`);
    }
    
    // Create/update the pull request with spam detection results
    const { error: prError } = await supabase
      .from('pull_requests')
      .upsert({
        github_id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        repository_id: repositoryId,
        author_id: contributor.id,
        base_branch: pr.base?.ref || 'main',
        head_branch: pr.head?.ref || 'unknown',
        draft: pr.draft || false,
        merged: pr.merged || false,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        closed_at: pr.closed_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        html_url: pr.html_url,
        // Add spam detection fields
        spam_score: spamResult.spam_score,
        spam_flags: spamResult.flags,
        is_spam: spamResult.is_spam,
        spam_detected_at: spamResult.detected_at
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
    
    if (prError) {
      console.error(`[Spam Detection] Error upserting pull request #${pr.number}:`, prError)
      return { success: false, error: prError.message };
    }
    
    console.log(`[Spam Detection] PR #${pr.number} processed - Spam Score: ${spamResult.spam_score}, Is Spam: ${spamResult.is_spam}`);
    
    return { success: true, spamResult };
  } catch (error) {
    console.error(`[Spam Detection] Error processing PR #${pr.number}:`, error)
    return { success: false, error: error.message };
  }
}

// Batch process existing PRs for spam detection
export async function batchProcessPRsForSpam(
  supabase: any,
  repositoryId: string,
  limit: number = 100
): Promise<{ processed: number; errors: number }> {
  const spamService = getSpamService(); // Use singleton for performance
  let processed = 0;
  let errors = 0;
  let offset = 0;
  const batchSize = 10; // Process 10 PRs concurrently for better performance
  
  console.log(`[Spam Detection] Starting batch processing for repository ${repositoryId}`);
  
  while (true) {
    // Fetch PRs without spam scores
    const { data: prs, error: fetchError } = await supabase
      .from('pull_requests')
      .select(`
        id,
        github_id,
        number,
        title,
        body,
        additions,
        deletions,
        changed_files,
        created_at,
        html_url,
        author:contributors(
          id,
          github_id,
          username,
          created_at,
          first_seen_at
        ),
        repository:repositories(
          full_name
        )
      `)
      .eq('repository_id', repositoryId)
      .is('spam_score', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (fetchError) {
      console.error(`[Spam Detection] Error fetching PRs:`, fetchError);
      break;
    }
    
    if (!prs || prs.length === 0) {
      break;
    }
    
    // Process PRs in concurrent batches for better performance
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pr) => {
        try {
          // Convert to spam detection format
          const prData: PullRequestData = {
            id: pr.id,
            title: pr.title,
            body: pr.body || '',
            number: pr.number,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
            created_at: pr.created_at,
            html_url: pr.html_url,
            author: {
              id: pr.author.github_id,
              login: pr.author.username,
              created_at: pr.author.created_at || pr.author.first_seen_at,
              // These fields might not be available in DB, but that's ok
              public_repos: undefined,
              followers: undefined,
              following: undefined,
              bio: undefined,
              company: undefined,
              location: undefined,
            },
            repository: {
              full_name: pr.repository.full_name,
            },
          };
          
          // Run spam detection
          const spamResult = await spamService.detectSpam(prData);
          
          // Update PR with spam detection results
          const { error: updateError } = await supabase
            .from('pull_requests')
            .update({
              spam_score: spamResult.spam_score,
              spam_flags: spamResult.flags,
              is_spam: spamResult.is_spam,
              spam_detected_at: spamResult.detected_at
            })
            .eq('id', pr.id);
          
          if (updateError) {
            console.error(`[Spam Detection] Error updating PR ${pr.number}:`, updateError);
            return { success: false, prNumber: pr.number };
          } else {
            return { success: true, prNumber: pr.number };
          }
        } catch (error) {
          console.error(`[Spam Detection] Error processing PR ${pr.number}:`, error);
          return { success: false, prNumber: pr.number };
        }
      });
      
      // Wait for batch to complete
      const results = await Promise.all(batchPromises);
      
      // Count successes and failures
      results.forEach(result => {
        if (result.success) {
          processed++;
        } else {
          errors++;
        }
      });
      
      // Log progress
      console.log(`[Spam Detection] Batch complete. Total processed: ${processed}, errors: ${errors}`);
    }
    
    offset += limit;
  }
  
  console.log(`[Spam Detection] Batch processing complete. Processed: ${processed}, Errors: ${errors}`);
  
  return { processed, errors };
}