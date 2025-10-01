import { IssuesEvent, Issue, Repository, DatabaseIssue } from '../types/github';
import { processNewIssue, formatSimilarIssuesComment } from '../services/issue-similarity';
import { createIssueComment } from '../services/github-api';
import { webhookDataService } from '../services/webhook/data-service';
import { embeddingQueueService } from '../services/webhook/embedding-queue';
import { webhookSimilarityService } from '../services/webhook/similarity-updater';
import { eventRouter } from './event-router';
import { supabase } from '../../src/lib/supabase';

/**
 * Handle issue webhook events with routing and prioritization
 */
export async function handleIssuesEvent(event: IssuesEvent) {
  console.log('Issue %s: #%d in %s', event.action, event.issue.number, event.repository.full_name);

  // Route event through EventRouter for prioritization and debouncing
  await eventRouter.routeEvent(event);

  // Process event based on action
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
    // Use shared service to check repository
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (!repoId) {
      console.log('Repository not tracked, skipping issue storage');
      return;
    }

    // Use shared service to store issue (includes contributor upsert)
    const issueId = await webhookDataService.storeIssue(event.issue, repoId);
    if (!issueId) {
      console.error('Failed to create issue record in database');
      return;
    }

    // Process issue for similarity
    const similarIssues = await processNewIssue({
      id: issueId,
      github_id: event.issue.id,
      number: event.issue.number,
      title: event.issue.title,
      body: event.issue.body,
      repository_id: repoId,
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

    // Use shared service to queue embedding generation
    await embeddingQueueService.queueIssueEmbedding(issueId, repoId, 'high');

    // Trigger real-time similarity recalculation for all open PRs
    await webhookSimilarityService.handleIssueEvent('opened', event.issue, repoId);
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
    // Use shared service to update issue state
    await webhookDataService.updateIssueState(
      event.issue.id,
      'closed',
      event.issue.closed_at,
      event.sender.id
    );

    // Check if closed by a PR
    if (event.issue.closed_at) {
      await checkIfClosedByPR(event.issue, event.repository);
    }

    // Trigger similarity recalculation to update closed status
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (repoId) {
      await webhookSimilarityService.handleIssueEvent('closed', event.issue, repoId);
    }
  } catch (error) {
    console.error('Error handling issue closed: %o', error);
  }
}

/**
 * Handle issue reopening
 */
async function handleIssueReopened(event: IssuesEvent) {
  try {
    // Use shared service to update issue state
    await webhookDataService.updateIssueState(event.issue.id, 'open', null, null);

    // Trigger similarity recalculation to update reopened status
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (repoId) {
      await webhookSimilarityService.handleIssueEvent('reopened', event.issue, repoId);
    }
  } catch (error) {
    console.error('Error handling issue reopened: %s', error);
  }
}

/**
 * Handle issue edits
 */
async function handleIssueEdited(event: IssuesEvent) {
  try {
    // Use shared service to update issue metadata
    await webhookDataService.updateIssueMetadata(event.issue.id, {
      title: event.issue.title,
      body: event.issue.body,
      updated_at: event.issue.updated_at,
    });

    // Use shared service to queue similarity recalculation
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (repoId) {
      await embeddingQueueService.queueSimilarityRecalculation(repoId, 'issue_edited');

      // Trigger real-time similarity recalculation with cache invalidation
      await webhookSimilarityService.handleIssueEvent('edited', event.issue, repoId);
    }
  } catch (error) {
    console.error('Error handling issue edited: %s', error);
  }
}

/**
 * Handle issue label changes
 */
async function handleIssueLabeled(event: IssuesEvent) {
  try {
    // Use shared service to update issue metadata
    await webhookDataService.updateIssueMetadata(event.issue.id, {
      labels: event.issue.labels,
      updated_at: event.issue.updated_at,
    });
  } catch (error) {
    console.error('Error handling issue labeled: %s', error);
  }
}

/**
 * Handle issue assignment changes
 */
async function handleIssueAssigned(event: IssuesEvent) {
  try {
    // Use shared service to update issue metadata
    await webhookDataService.updateIssueMetadata(event.issue.id, {
      assignees: event.issue.assignees.map((a) => ({
        id: a.id,
        login: a.login,
      })),
      updated_at: event.issue.updated_at,
    });
  } catch (error) {
    console.error('Error handling issue assigned: %s', error);
  }
}

/**
 * Check if an issue might be a duplicate
 */
async function checkForDuplicateIssues(issue: Issue, repositoryId: string) {
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
    const potentialDuplicates = recentIssues.filter((existingIssue) => {
      const similarity = calculateTitleSimilarity(issue.title, existingIssue.title);
      return similarity > 0.8; // 80% similarity threshold
    });

    if (potentialDuplicates.length > 0) {
      // Could post a comment or send a notification
      console.log(
        `Issue #${issue.number} might be duplicate of:`,
        potentialDuplicates.map((i) => `#${i.number}`).join(', ')
      );
    }
  } catch (error) {
    console.error('Error checking for duplicates: %s', error);
  }
}

/**
 * Check if issue was closed by a PR
 */
async function checkIfClosedByPR(issue: Issue, repository: Repository) {
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
      const closingPR = linkedPRs.find(
        (pr) =>
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

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
