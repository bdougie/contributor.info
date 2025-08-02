import { IssuesEvent } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { inngest } from '../../src/lib/inngest/client';
import { processNewIssue, formatSimilarIssuesComment } from '../services/issue-similarity';
import { createIssueComment } from '../services/github-api';

/**
 * Handle issue webhook events
 */
export async function handleIssuesEvent(event: IssuesEvent) {
  console.log(`Issue ${event.action}: #${event.issue.number} in ${event.repository.full_name}`);

  switch (event.action) {
    case 'opened':
      await handleIssueOpened(event);
      break;
    case 'closed':
      await handleIssueClosed(event);
      break;
    case 'reopened':
      await handleIssueReopened(event);
      break;
    case 'edited':
      await handleIssueEdited(event);
      break;
    case 'labeled':
    case 'unlabeled':
      await handleIssueLabeled(event);
      break;
    case 'assigned':
    case 'unassigned':
      await handleIssueAssigned(event);
      break;
  }
}

/**
 * Handle new issue creation
 */
async function handleIssueOpened(event: IssuesEvent) {
  try {
    // Check if repository exists in our database
    const { data: repository } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', event.repository.id)
      .single();

    if (!repository) {
      console.log('Repository not tracked, skipping issue storage');
      return;
    }

    // Get or create contributor
    const { data: contributor } = await supabase
      .from('contributors')
      .upsert({
        github_id: event.issue.user.id,
        github_login: event.issue.user.login,
        avatar_url: event.issue.user.avatar_url,
        html_url: event.issue.user.html_url,
        type: event.issue.user.type,
      })
      .select('id')
      .single();

    // Store the issue
    const { data: issueData } = await supabase
      .from('issues')
      .upsert({
        github_id: event.issue.id,
        repository_id: repository.id,
        number: event.issue.number,
        title: event.issue.title,
        body: event.issue.body,
        state: event.issue.state,
        author_id: contributor?.id,
        created_at: event.issue.created_at,
        updated_at: event.issue.updated_at,
        labels: event.issue.labels,
        assignees: event.issue.assignees.map(a => ({
          id: a.id,
          login: a.login,
        })),
        comments_count: event.issue.comments,
        is_pull_request: !!event.issue.pull_request,
      })
      .select('id')
      .single();

    // Process issue for similarity and generate embeddings
    const similarIssues = await processNewIssue({
      id: issueData.id,
      github_id: event.issue.id,
      number: event.issue.number,
      title: event.issue.title,
      body: event.issue.body,
      repository_id: repository.id,
      html_url: event.issue.html_url,
    });

    // Post comment if similar issues found
    if (similarIssues.length > 0) {
      const comment = formatSimilarIssuesComment(similarIssues);
      if (comment) {
        await createIssueComment(
          event.repository.owner.login,
          event.repository.name,
          event.issue.number,
          comment
        );
      }
    }

    // Queue for additional analysis
    await inngest.send({
      name: 'github.issue.analyze',
      data: {
        issue_id: event.issue.id,
        issue_number: event.issue.number,
        repository_id: repository.id,
        repository_name: event.repository.full_name,
      },
    });

  } catch (error) {
    console.error('Error handling issue opened:', error);
    // Re-throw to allow webhook retry
    throw error;
  }
}

/**
 * Handle issue closure
 */
async function handleIssueClosed(event: IssuesEvent) {
  try {
    // Update issue state
    await supabase
      .from('issues')
      .update({
        state: 'closed',
        closed_at: event.issue.closed_at,
        closed_by_id: event.sender.id,
        updated_at: event.issue.updated_at,
      })
      .eq('github_id', event.issue.id);

    // Check if closed by a PR
    if (event.issue.closed_at) {
      await checkIfClosedByPR(event.issue, event.repository);
    }

  } catch (error) {
    console.error('Error handling issue closed: %s', error);
  }
}

/**
 * Handle issue reopening
 */
async function handleIssueReopened(event: IssuesEvent) {
  try {
    await supabase
      .from('issues')
      .update({
        state: 'open',
        closed_at: null,
        closed_by_id: null,
        updated_at: event.issue.updated_at,
      })
      .eq('github_id', event.issue.id);

  } catch (error) {
    console.error('Error handling issue reopened: %s', error);
  }
}

/**
 * Handle issue edits
 */
async function handleIssueEdited(event: IssuesEvent) {
  try {
    await supabase
      .from('issues')
      .update({
        title: event.issue.title,
        body: event.issue.body,
        updated_at: event.issue.updated_at,
      })
      .eq('github_id', event.issue.id);

    // Re-calculate similarities if title or body changed significantly
    await inngest.send({
      name: 'github.issue.recalculate_similarity',
      data: {
        issue_id: event.issue.id,
        repository_id: event.repository.id,
      },
    });

  } catch (error) {
    console.error('Error handling issue edited: %s', error);
  }
}

/**
 * Handle issue label changes
 */
async function handleIssueLabeled(event: IssuesEvent) {
  try {
    await supabase
      .from('issues')
      .update({
        labels: event.issue.labels,
        updated_at: event.issue.updated_at,
      })
      .eq('github_id', event.issue.id);

  } catch (error) {
    console.error('Error handling issue labeled: %s', error);
  }
}

/**
 * Handle issue assignment changes
 */
async function handleIssueAssigned(event: IssuesEvent) {
  try {
    await supabase
      .from('issues')
      .update({
        assignees: event.issue.assignees.map(a => ({
          id: a.id,
          login: a.login,
        })),
        updated_at: event.issue.updated_at,
      })
      .eq('github_id', event.issue.id);

  } catch (error) {
    console.error('Error handling issue assigned: %s', error);
  }
}

/**
 * Check if an issue might be a duplicate
 */
async function checkForDuplicateIssues(issue: any, repositoryId: string) {
  try {
    // Get recent issues with similar titles
    const { data: recentIssues } = await supabase
      .from('issues')
      .select('*')
      .eq('repository_id', repositoryId)
      .eq('state', 'open')
      .neq('github_id', issue.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!recentIssues || recentIssues.length === 0) return;

    // Simple duplicate detection based on title similarity
    const potentialDuplicates = recentIssues.filter(existingIssue => {
      const similarity = calculateTitleSimilarity(issue.title, existingIssue.title);
      return similarity > 0.8; // 80% similarity threshold
    });

    if (potentialDuplicates.length > 0) {
      // Could post a comment or send a notification
      console.log(`Issue #${issue.number} might be duplicate of:`, 
        potentialDuplicates.map(i => `#${i.number}`).join(', '));
    }

  } catch (error) {
    console.error('Error checking for duplicates: %s', error);
  }
}

/**
 * Check if issue was closed by a PR
 */
async function checkIfClosedByPR(issue: any, repository: any) {
  try {
    // Look for PRs that mention this issue
    const { data: linkedPRs } = await supabase
      .from('pull_requests')
      .select('*')
      .eq('repository_id', repository.id)
      .or(`title.ilike.*#${issue.number}*,body.ilike.*#${issue.number}*`)
      .eq('state', 'closed');

    if (linkedPRs && linkedPRs.length > 0) {
      // Update issue with linked PR
      const closingPR = linkedPRs.find(pr => 
        pr.body?.toLowerCase().includes(`fixes #${issue.number}`) ||
        pr.body?.toLowerCase().includes(`closes #${issue.number}`)
      );

      if (closingPR) {
        await supabase
          .from('issues')
          .update({
            linked_pr_id: closingPR.id,
          })
          .eq('github_id', issue.id);
      }
    }

  } catch (error) {
    console.error('Error checking if closed by PR: %s', error);
  }
}

/**
 * Calculate simple title similarity
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = title1.toLowerCase().split(/\s+/);
  const words2 = title2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}