/**
 * Integration tests for S3 Storage Checkpoint Recovery
 *
 * These tests simulate real-world scenarios where Inngest jobs
 * are interrupted and need to resume from a checkpoint.
 */

import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  saveCheckpoint,
  loadCheckpoint,
  deleteCheckpoint,
  hasCheckpoint,
  listCheckpoints,
  appendAuditLog,
  readAuditLog,
  type JobCheckpoint,
} from '../_shared/s3-storage.ts';

const TEST_PREFIX = `integration-${Date.now()}`;

// Helper to clean up test checkpoints
async function cleanupCheckpoints(jobType: string, jobIds: string[]): Promise<void> {
  for (const jobId of jobIds) {
    await deleteCheckpoint(jobType, jobId);
  }
}

// ============================================================================
// Repository Sync Recovery Tests
// ============================================================================

Deno.test('Integration: Repository sync checkpoint recovery', async () => {
  const jobType = `${TEST_PREFIX}-repo-sync`;
  const jobId = 'repo-123-sync';

  interface RepoSyncProgress {
    repositoryId: string;
    repositoryName: string;
    totalPRs: number;
    processedPRs: number;
    processedPRIds: string[];
    failedPRIds: string[];
    startedAt: string;
  }

  try {
    // Simulate job start
    const initialProgress: RepoSyncProgress = {
      repositoryId: 'repo-123',
      repositoryName: 'owner/repo',
      totalPRs: 500,
      processedPRs: 0,
      processedPRIds: [],
      failedPRIds: [],
      startedAt: new Date().toISOString(),
    };

    await appendAuditLog(jobType, jobId, 'started', {
      repositoryId: initialProgress.repositoryId,
      totalPRs: initialProgress.totalPRs,
    });

    // Simulate processing first batch (100 PRs)
    const batch1Progress: RepoSyncProgress = {
      ...initialProgress,
      processedPRs: 100,
      processedPRIds: Array.from({ length: 100 }, (_, i) => `pr-${i + 1}`),
    };
    await saveCheckpoint(jobType, jobId, batch1Progress, 20, 'pr-100');

    // Simulate job interruption (timeout after 150 seconds)
    // ...job dies here...

    // Simulate job restart - check for existing checkpoint
    const existingCheckpoint = await loadCheckpoint<RepoSyncProgress>(jobType, jobId);
    assertExists(existingCheckpoint);
    assertEquals(existingCheckpoint.progress, 20);
    assertEquals(existingCheckpoint.lastProcessedId, 'pr-100');
    assertEquals(existingCheckpoint.data.processedPRs, 100);

    // Resume from checkpoint - process next batch
    const resumeProgress: RepoSyncProgress = {
      ...existingCheckpoint.data,
      processedPRs: 200,
      processedPRIds: [
        ...existingCheckpoint.data.processedPRIds,
        ...Array.from({ length: 100 }, (_, i) => `pr-${i + 101}`),
      ],
    };
    await saveCheckpoint(jobType, jobId, resumeProgress, 40, 'pr-200');

    // Continue processing...
    const finalProgress: RepoSyncProgress = {
      ...resumeProgress,
      processedPRs: 500,
      processedPRIds: Array.from({ length: 500 }, (_, i) => `pr-${i + 1}`),
    };
    await saveCheckpoint(jobType, jobId, finalProgress, 100, 'pr-500');

    // Verify final state
    const finalCheckpoint = await loadCheckpoint<RepoSyncProgress>(jobType, jobId);
    assertExists(finalCheckpoint);
    assertEquals(finalCheckpoint.progress, 100);
    assertEquals(finalCheckpoint.data.processedPRs, 500);
    assertEquals(finalCheckpoint.data.processedPRIds.length, 500);

    // Log completion
    await appendAuditLog(jobType, jobId, 'completed', {
      totalProcessed: 500,
      failed: 0,
    });

    // Clean up checkpoint after successful completion
    await deleteCheckpoint(jobType, jobId);
    const hasCheckpointAfter = await hasCheckpoint(jobType, jobId);
    assertEquals(hasCheckpointAfter, false);

    // Verify audit log
    const auditEntries = await readAuditLog(jobType, jobId);
    assertEquals(auditEntries.length, 2);
    assertEquals(auditEntries[0].action, 'started');
    assertEquals(auditEntries[1].action, 'completed');
  } finally {
    await cleanupCheckpoints(jobType, [jobId]);
    // Clean up audit log
    const auditPath = `audit/${jobType}/${jobId}.jsonl`;
    try {
      await Deno.remove(`/tmp/${auditPath}`);
    } catch {
      // Ignore if doesn't exist
    }
  }
});

// ============================================================================
// Concurrent Job Recovery Tests
// ============================================================================

Deno.test('Integration: Multiple concurrent jobs with independent checkpoints', async () => {
  const jobType = `${TEST_PREFIX}-concurrent`;
  const jobs = [
    { id: 'job-a', repoId: 'repo-001', totalItems: 100 },
    { id: 'job-b', repoId: 'repo-002', totalItems: 250 },
    { id: 'job-c', repoId: 'repo-003', totalItems: 50 },
  ];

  interface ConcurrentJobProgress {
    repoId: string;
    processed: number;
    total: number;
  }

  try {
    // Start all jobs
    await Promise.all(
      jobs.map(async (job) => {
        await saveCheckpoint<ConcurrentJobProgress>(
          jobType,
          job.id,
          { repoId: job.repoId, processed: 0, total: job.totalItems },
          0
        );
      })
    );

    // Verify all jobs started
    const activeJobs = await listCheckpoints(jobType);
    assertEquals(activeJobs.length, 3);

    // Simulate partial progress on each job
    await saveCheckpoint<ConcurrentJobProgress>(
      jobType,
      'job-a',
      { repoId: 'repo-001', processed: 50, total: 100 },
      50,
      'item-50'
    );
    await saveCheckpoint<ConcurrentJobProgress>(
      jobType,
      'job-b',
      { repoId: 'repo-002', processed: 100, total: 250 },
      40,
      'item-100'
    );
    await saveCheckpoint<ConcurrentJobProgress>(
      jobType,
      'job-c',
      { repoId: 'repo-003', processed: 50, total: 50 },
      100,
      'item-50'
    );

    // Job C completes - delete its checkpoint
    await deleteCheckpoint(jobType, 'job-c');

    // Simulate restart - load remaining checkpoints
    const remainingJobs = await listCheckpoints(jobType);
    assertEquals(remainingJobs.length, 2);
    assert(remainingJobs.includes('job-a'));
    assert(remainingJobs.includes('job-b'));
    assert(!remainingJobs.includes('job-c'));

    // Verify each checkpoint has correct state
    const jobACheckpoint = await loadCheckpoint<ConcurrentJobProgress>(jobType, 'job-a');
    const jobBCheckpoint = await loadCheckpoint<ConcurrentJobProgress>(jobType, 'job-b');

    assertExists(jobACheckpoint);
    assertExists(jobBCheckpoint);

    assertEquals(jobACheckpoint.progress, 50);
    assertEquals(jobACheckpoint.data.processed, 50);

    assertEquals(jobBCheckpoint.progress, 40);
    assertEquals(jobBCheckpoint.data.processed, 100);
  } finally {
    await cleanupCheckpoints(jobType, jobs.map((j) => j.id));
  }
});

// ============================================================================
// Error Recovery Tests
// ============================================================================

Deno.test('Integration: Checkpoint preserves error state for debugging', async () => {
  const jobType = `${TEST_PREFIX}-error-recovery`;
  const jobId = 'job-with-errors';

  interface ErrorRecoveryProgress {
    itemsProcessed: number;
    errors: Array<{
      itemId: string;
      error: string;
      timestamp: string;
    }>;
    retryCount: number;
  }

  try {
    // Start job
    const initialState: ErrorRecoveryProgress = {
      itemsProcessed: 0,
      errors: [],
      retryCount: 0,
    };
    await saveCheckpoint(jobType, jobId, initialState, 0);

    // Simulate some successful processing followed by errors
    const stateWithErrors: ErrorRecoveryProgress = {
      itemsProcessed: 45,
      errors: [
        { itemId: 'item-46', error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
        { itemId: 'item-47', error: 'Rate limit exceeded', timestamp: new Date().toISOString() },
      ],
      retryCount: 1,
    };
    await saveCheckpoint(jobType, jobId, stateWithErrors, 45, 'item-45');

    // Log error event
    await appendAuditLog(jobType, jobId, 'error', {
      type: 'rate_limit',
      failedItems: 2,
      willRetry: true,
    });

    // Simulate job restart after backoff
    const checkpoint = await loadCheckpoint<ErrorRecoveryProgress>(jobType, jobId);
    assertExists(checkpoint);
    assertEquals(checkpoint.data.errors.length, 2);
    assertEquals(checkpoint.data.retryCount, 1);
    assertEquals(checkpoint.lastProcessedId, 'item-45');

    // Retry and complete successfully
    const completedState: ErrorRecoveryProgress = {
      itemsProcessed: 100,
      errors: checkpoint.data.errors, // Preserve error history
      retryCount: 2,
    };
    await saveCheckpoint(jobType, jobId, completedState, 100, 'item-100');

    // Verify error history preserved
    const finalCheckpoint = await loadCheckpoint<ErrorRecoveryProgress>(jobType, jobId);
    assertExists(finalCheckpoint);
    assertEquals(finalCheckpoint.data.errors.length, 2);
    assertEquals(finalCheckpoint.data.retryCount, 2);
    assertEquals(finalCheckpoint.progress, 100);

    await appendAuditLog(jobType, jobId, 'completed', {
      totalProcessed: 100,
      errorsEncountered: 2,
      retriesPerformed: 2,
    });
  } finally {
    await cleanupCheckpoints(jobType, [jobId]);
    try {
      await Deno.remove(`/tmp/audit/${jobType}/${jobId}.jsonl`);
    } catch {
      // Ignore
    }
  }
});

// ============================================================================
// Timestamp Preservation Tests
// ============================================================================

Deno.test('Integration: createdAt preserved across multiple updates', async () => {
  const jobType = `${TEST_PREFIX}-timestamps`;
  const jobId = 'timestamp-test';

  try {
    // Create initial checkpoint
    await saveCheckpoint(jobType, jobId, { step: 1 }, 10);
    const initial = await loadCheckpoint(jobType, jobId);
    assertExists(initial);
    const originalCreatedAt = initial.createdAt;
    const originalUpdatedAt = initial.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Update multiple times
    for (let i = 2; i <= 5; i++) {
      await saveCheckpoint(jobType, jobId, { step: i }, i * 20);
    }

    // Verify createdAt preserved, updatedAt changed
    const final = await loadCheckpoint(jobType, jobId);
    assertExists(final);
    assertEquals(final.createdAt, originalCreatedAt);
    assert(final.updatedAt !== originalUpdatedAt);
    assertEquals(final.data.step, 5);
    assertEquals(final.progress, 100);
  } finally {
    await cleanupCheckpoints(jobType, [jobId]);
  }
});
