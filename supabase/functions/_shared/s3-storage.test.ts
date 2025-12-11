import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  appendAuditLog,
  deleteCheckpoint,
  deleteFile,
  fileExists,
  getBasePath,
  getStoragePath,
  hasCheckpoint,
  isS3Configured,
  type JobCheckpoint,
  listCheckpoints,
  loadCheckpoint,
  readAuditLog,
  readJson,
  readTextFile,
  saveCheckpoint,
  writeJson,
  writeTextFile,
} from './s3-storage.ts';

// Test with ephemeral storage (no S3 configured)
// These tests use /tmp which is available in all environments

const TEST_PREFIX = `test-${Date.now()}`;

// Helper to clean up test files
async function cleanup(keys: string[]): Promise<void> {
  for (const key of keys) {
    await deleteFile(key);
  }
}

// ============================================================================
// Configuration Tests
// ============================================================================

Deno.test('isS3Configured - returns false when env vars not set', () => {
  // In test environment, S3 env vars should not be set
  const configured = isS3Configured();
  assertEquals(configured, false);
});

Deno.test('getBasePath - returns /tmp when S3 not configured', () => {
  const basePath = getBasePath();
  assertEquals(basePath, '/tmp');
});

Deno.test('getStoragePath - constructs correct path', () => {
  const path = getStoragePath('test/file.json');
  assert(path.endsWith('/test/file.json'));
});

Deno.test('getStoragePath - handles leading slash in key', () => {
  const path = getStoragePath('/test/file.json');
  // Should not have double slashes
  assert(!path.includes('//'));
  assert(path.endsWith('/test/file.json'));
});

// ============================================================================
// Basic File Operations Tests
// ============================================================================

Deno.test('writeTextFile/readTextFile - writes and reads text content', async () => {
  const key = `${TEST_PREFIX}/basic-text.txt`;
  const content = 'Hello, World!';

  try {
    const writeSuccess = await writeTextFile(key, content);
    assertEquals(writeSuccess, true);

    const readContent = await readTextFile(key);
    assertEquals(readContent, content);
  } finally {
    await cleanup([key]);
  }
});

Deno.test('writeJson/readJson - writes and reads JSON content', async () => {
  const key = `${TEST_PREFIX}/basic-json.json`;
  const data = { name: 'test', count: 42, nested: { flag: true } };

  try {
    const writeSuccess = await writeJson(key, data);
    assertEquals(writeSuccess, true);

    const readData = await readJson<typeof data>(key);
    assertExists(readData);
    assertEquals(readData.name, 'test');
    assertEquals(readData.count, 42);
    assertEquals(readData.nested.flag, true);
  } finally {
    await cleanup([key]);
  }
});

Deno.test('readTextFile - returns null for non-existent file', async () => {
  const content = await readTextFile(`${TEST_PREFIX}/non-existent.txt`);
  assertEquals(content, null);
});

Deno.test('readJson - returns null for non-existent file', async () => {
  const data = await readJson(`${TEST_PREFIX}/non-existent.json`);
  assertEquals(data, null);
});

Deno.test('deleteFile - deletes existing file', async () => {
  const key = `${TEST_PREFIX}/to-delete.txt`;

  // Create file
  await writeTextFile(key, 'delete me');
  const existsBefore = await fileExists(key);
  assertEquals(existsBefore, true);

  // Delete file
  const deleteSuccess = await deleteFile(key);
  assertEquals(deleteSuccess, true);

  // Verify deleted
  const existsAfter = await fileExists(key);
  assertEquals(existsAfter, false);
});

Deno.test('deleteFile - returns true for non-existent file', async () => {
  const success = await deleteFile(`${TEST_PREFIX}/already-deleted.txt`);
  assertEquals(success, true);
});

Deno.test('fileExists - returns correct status', async () => {
  const key = `${TEST_PREFIX}/exists-check.txt`;

  try {
    // File doesn't exist yet
    const existsBefore = await fileExists(key);
    assertEquals(existsBefore, false);

    // Create file
    await writeTextFile(key, 'exists');

    // File now exists
    const existsAfter = await fileExists(key);
    assertEquals(existsAfter, true);
  } finally {
    await cleanup([key]);
  }
});

// ============================================================================
// Checkpoint Management Tests
// ============================================================================

Deno.test('saveCheckpoint - creates checkpoint with correct structure', async () => {
  const jobType = `${TEST_PREFIX}-sync`;
  const jobId = 'job-001';
  const data = { repositoryId: 'repo-123', prsProcessed: 50 };

  try {
    const success = await saveCheckpoint(jobType, jobId, data, 50, 'pr-100');
    assertEquals(success, true);

    const checkpoint = await loadCheckpoint<typeof data>(jobType, jobId);
    assertExists(checkpoint);
    assertEquals(checkpoint.jobId, jobId);
    assertEquals(checkpoint.jobType, jobType);
    assertEquals(checkpoint.progress, 50);
    assertEquals(checkpoint.lastProcessedId, 'pr-100');
    assertEquals(checkpoint.data.repositoryId, 'repo-123');
    assertEquals(checkpoint.data.prsProcessed, 50);
    assertExists(checkpoint.createdAt);
    assertExists(checkpoint.updatedAt);
    assertExists(checkpoint.lastProcessedAt);
  } finally {
    await deleteCheckpoint(jobType, jobId);
  }
});

Deno.test('saveCheckpoint - clamps progress to 0-100 range', async () => {
  const jobType = `${TEST_PREFIX}-clamp`;
  const jobId = 'job-clamp';

  try {
    // Test > 100
    await saveCheckpoint(jobType, jobId, {}, 150);
    let checkpoint = await loadCheckpoint(jobType, jobId);
    assertEquals(checkpoint?.progress, 100);

    // Test < 0
    await saveCheckpoint(jobType, jobId, {}, -10);
    checkpoint = await loadCheckpoint(jobType, jobId);
    assertEquals(checkpoint?.progress, 0);
  } finally {
    await deleteCheckpoint(jobType, jobId);
  }
});

Deno.test('saveCheckpoint - preserves createdAt on update', async () => {
  const jobType = `${TEST_PREFIX}-preserve`;
  const jobId = 'job-preserve';

  try {
    // Create initial checkpoint
    await saveCheckpoint(jobType, jobId, { step: 1 }, 25);
    const initial = await loadCheckpoint(jobType, jobId);
    assertExists(initial);
    const originalCreatedAt = initial.createdAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update checkpoint
    await saveCheckpoint(jobType, jobId, { step: 2 }, 50);
    const updated = await loadCheckpoint(jobType, jobId);
    assertExists(updated);

    // createdAt should be preserved
    assertEquals(updated.createdAt, originalCreatedAt);
    // updatedAt should be different
    assert(updated.updatedAt !== originalCreatedAt);
  } finally {
    await deleteCheckpoint(jobType, jobId);
  }
});

Deno.test('loadCheckpoint - returns null for non-existent checkpoint', async () => {
  const checkpoint = await loadCheckpoint('non-existent', 'job-000');
  assertEquals(checkpoint, null);
});

Deno.test('hasCheckpoint - returns correct status', async () => {
  const jobType = `${TEST_PREFIX}-has`;
  const jobId = 'job-has';

  try {
    // Doesn't exist yet
    const existsBefore = await hasCheckpoint(jobType, jobId);
    assertEquals(existsBefore, false);

    // Create checkpoint
    await saveCheckpoint(jobType, jobId, {}, 0);

    // Now exists
    const existsAfter = await hasCheckpoint(jobType, jobId);
    assertEquals(existsAfter, true);
  } finally {
    await deleteCheckpoint(jobType, jobId);
  }
});

Deno.test('deleteCheckpoint - removes checkpoint', async () => {
  const jobType = `${TEST_PREFIX}-delete`;
  const jobId = 'job-delete';

  // Create checkpoint
  await saveCheckpoint(jobType, jobId, {}, 50);
  const existsBefore = await hasCheckpoint(jobType, jobId);
  assertEquals(existsBefore, true);

  // Delete checkpoint
  const success = await deleteCheckpoint(jobType, jobId);
  assertEquals(success, true);

  // Verify deleted
  const existsAfter = await hasCheckpoint(jobType, jobId);
  assertEquals(existsAfter, false);
});

Deno.test('listCheckpoints - lists all checkpoints for job type', async () => {
  const jobType = `${TEST_PREFIX}-list`;
  const jobIds = ['job-a', 'job-b', 'job-c'];

  try {
    // Create multiple checkpoints
    for (const jobId of jobIds) {
      await saveCheckpoint(jobType, jobId, {}, 0);
    }

    // List checkpoints
    const listed = await listCheckpoints(jobType);
    assertEquals(listed.length, 3);
    for (const jobId of jobIds) {
      assert(listed.includes(jobId));
    }
  } finally {
    for (const jobId of jobIds) {
      await deleteCheckpoint(jobType, jobId);
    }
  }
});

Deno.test('listCheckpoints - returns empty array for non-existent job type', async () => {
  const listed = await listCheckpoints('non-existent-type');
  assertEquals(listed.length, 0);
});

// ============================================================================
// Checkpoint Recovery Pattern Tests
// ============================================================================

Deno.test('checkpoint recovery pattern - simulates job resume', async () => {
  const jobType = `${TEST_PREFIX}-recovery`;
  const jobId = 'job-recovery';

  interface SyncProgress {
    repositoryId: string;
    totalPRs: number;
    processedPRs: string[];
  }

  try {
    // Simulate first run - partial completion
    const initialData: SyncProgress = {
      repositoryId: 'repo-123',
      totalPRs: 100,
      processedPRs: ['pr-1', 'pr-2', 'pr-3'],
    };
    await saveCheckpoint(jobType, jobId, initialData, 3, 'pr-3');

    // Simulate job restart - check for existing checkpoint
    const existing = await loadCheckpoint<SyncProgress>(jobType, jobId);
    assertExists(existing);
    assertEquals(existing.lastProcessedId, 'pr-3');
    assertEquals(existing.data.processedPRs.length, 3);

    // Resume from checkpoint
    const resumeData: SyncProgress = {
      ...existing.data,
      processedPRs: [...existing.data.processedPRs, 'pr-4', 'pr-5'],
    };
    await saveCheckpoint(jobType, jobId, resumeData, 5, 'pr-5');

    // Verify progress
    const afterResume = await loadCheckpoint<SyncProgress>(jobType, jobId);
    assertExists(afterResume);
    assertEquals(afterResume.progress, 5);
    assertEquals(afterResume.data.processedPRs.length, 5);

    // Simulate completion - clean up checkpoint
    await deleteCheckpoint(jobType, jobId);
    const afterComplete = await hasCheckpoint(jobType, jobId);
    assertEquals(afterComplete, false);
  } finally {
    await deleteCheckpoint(jobType, jobId);
  }
});

// ============================================================================
// Audit Log Tests
// ============================================================================

Deno.test('appendAuditLog/readAuditLog - appends and reads log entries', async () => {
  const jobType = `${TEST_PREFIX}-audit`;
  const jobId = 'job-audit';

  try {
    // Append multiple entries
    await appendAuditLog(jobType, jobId, 'started', { source: 'test' });
    await appendAuditLog(jobType, jobId, 'progress', { processed: 50 });
    await appendAuditLog(jobType, jobId, 'completed', { total: 100 });

    // Read entries
    const entries = await readAuditLog(jobType, jobId);
    assertEquals(entries.length, 3);

    assertEquals(entries[0].action, 'started');
    assertEquals(entries[0].details?.source, 'test');

    assertEquals(entries[1].action, 'progress');
    assertEquals(entries[1].details?.processed, 50);

    assertEquals(entries[2].action, 'completed');
    assertEquals(entries[2].details?.total, 100);

    // All entries should have timestamps
    for (const entry of entries) {
      assertExists(entry.timestamp);
      assertEquals(entry.jobType, jobType);
      assertEquals(entry.jobId, jobId);
    }
  } finally {
    await deleteFile(`audit/${jobType}/${jobId}.jsonl`);
  }
});

Deno.test('readAuditLog - returns empty array for non-existent log', async () => {
  const entries = await readAuditLog('non-existent', 'job-000');
  assertEquals(entries.length, 0);
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

Deno.test('writeJson - handles complex nested objects', async () => {
  const key = `${TEST_PREFIX}/complex.json`;
  const data = {
    string: 'value',
    number: 42,
    boolean: true,
    null: null,
    array: [1, 2, 3],
    nested: {
      deep: {
        value: 'found',
      },
    },
  };

  try {
    await writeJson(key, data);
    const read = await readJson<typeof data>(key);
    assertExists(read);
    assertEquals(read.string, 'value');
    assertEquals(read.number, 42);
    assertEquals(read.boolean, true);
    assertEquals(read.null, null);
    assertEquals(read.array, [1, 2, 3]);
    assertEquals(read.nested.deep.value, 'found');
  } finally {
    await cleanup([key]);
  }
});

Deno.test('readJson - returns null for invalid JSON', async () => {
  const key = `${TEST_PREFIX}/invalid.json`;

  try {
    await writeTextFile(key, 'not valid json {{{');
    const data = await readJson(key);
    assertEquals(data, null);
  } finally {
    await cleanup([key]);
  }
});

Deno.test('writeTextFile - creates nested directories', async () => {
  const key = `${TEST_PREFIX}/deep/nested/path/file.txt`;

  try {
    const success = await writeTextFile(key, 'nested content');
    assertEquals(success, true);

    const content = await readTextFile(key);
    assertEquals(content, 'nested content');
  } finally {
    await cleanup([key]);
  }
});
