/**
 * S3 Persistent Storage Helper for Edge Functions
 *
 * Provides persistent file storage via Supabase Storage S3 protocol.
 * Falls back to ephemeral /tmp storage when S3 is not configured.
 *
 * Benefits:
 * - 97% faster cold starts with sync APIs during initialization
 * - Persistent state between function invocations
 * - Checkpoint/recovery for long-running jobs
 *
 * @see https://supabase.com/docs/guides/functions/ephemeral-storage
 */

// Configuration
const S3_BUCKET_NAME = 'edge-function-state';
const S3_BASE_PATH = `/s3/${S3_BUCKET_NAME}`;
const EPHEMERAL_BASE_PATH = '/tmp';

/**
 * Check if S3 storage is configured
 * Required env vars: S3FS_ENDPOINT_URL, S3FS_ACCESS_KEY_ID, S3FS_SECRET_ACCESS_KEY
 */
export function isS3Configured(): boolean {
  return !!(
    Deno.env.get('S3FS_ENDPOINT_URL') &&
    Deno.env.get('S3FS_ACCESS_KEY_ID') &&
    Deno.env.get('S3FS_SECRET_ACCESS_KEY')
  );
}

/**
 * Get the base path for storage (S3 or ephemeral fallback)
 */
export function getBasePath(): string {
  return isS3Configured() ? S3_BASE_PATH : EPHEMERAL_BASE_PATH;
}

/**
 * Get full path for a storage key
 */
export function getStoragePath(key: string): string {
  const base = getBasePath();
  // Ensure key doesn't start with /
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  return `${base}/${cleanKey}`;
}

// ============================================================================
// Sync APIs (ONLY use during initialization, not in request handlers)
// These provide 97% faster cold starts
// ============================================================================

/**
 * Read a file synchronously during initialization
 * WARNING: Only use during script initialization, NOT in request handlers
 */
export function readFileSync(key: string): Uint8Array | null {
  try {
    const path = getStoragePath(key);
    return Deno.readFileSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    console.error('S3 Storage readFileSync error for key %s:', key, error);
    return null;
  }
}

/**
 * Read a text file synchronously during initialization
 * WARNING: Only use during script initialization, NOT in request handlers
 */
export function readTextFileSync(key: string): string | null {
  try {
    const path = getStoragePath(key);
    return Deno.readTextFileSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    console.error('S3 Storage readTextFileSync error for key %s:', key, error);
    return null;
  }
}

/**
 * Read and parse JSON synchronously during initialization
 * WARNING: Only use during script initialization, NOT in request handlers
 */
export function readJsonSync<T>(key: string): T | null {
  const content = readTextFileSync(key);
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('S3 Storage readJsonSync parse error for key %s:', key, error);
    return null;
  }
}

// ============================================================================
// Async APIs (Use in request handlers)
// ============================================================================

/**
 * Read a file asynchronously
 */
export async function readFile(key: string): Promise<Uint8Array | null> {
  try {
    const path = getStoragePath(key);
    return await Deno.readFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    console.error('S3 Storage readFile error for key %s:', key, error);
    return null;
  }
}

/**
 * Read a text file asynchronously
 */
export async function readTextFile(key: string): Promise<string | null> {
  try {
    const path = getStoragePath(key);
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    console.error('S3 Storage readTextFile error for key %s:', key, error);
    return null;
  }
}

/**
 * Read and parse JSON asynchronously
 */
export async function readJson<T>(key: string): Promise<T | null> {
  const content = await readTextFile(key);
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('S3 Storage readJson parse error for key %s:', key, error);
    return null;
  }
}

/**
 * Write a file asynchronously
 */
export async function writeFile(key: string, data: Uint8Array): Promise<boolean> {
  try {
    const path = getStoragePath(key);
    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    await ensureDir(dir);
    await Deno.writeFile(path, data);
    return true;
  } catch (error) {
    console.error('S3 Storage writeFile error for key %s:', key, error);
    return false;
  }
}

/**
 * Write a text file asynchronously
 */
export async function writeTextFile(key: string, content: string): Promise<boolean> {
  try {
    const path = getStoragePath(key);
    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    await ensureDir(dir);
    await Deno.writeTextFile(path, content);
    return true;
  } catch (error) {
    console.error('S3 Storage writeTextFile error for key %s:', key, error);
    return false;
  }
}

/**
 * Write JSON asynchronously
 */
export async function writeJson<T>(key: string, data: T): Promise<boolean> {
  try {
    const content = JSON.stringify(data, null, 2);
    return await writeTextFile(key, content);
  } catch (error) {
    console.error('S3 Storage writeJson error for key %s:', key, error);
    return false;
  }
}

/**
 * Delete a file asynchronously
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const path = getStoragePath(key);
    await Deno.remove(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return true; // Already deleted
    }
    console.error('S3 Storage deleteFile error for key %s:', key, error);
    return false;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const path = getStoragePath(key);
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists
 */
async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

// ============================================================================
// Checkpoint Management for Long-Running Jobs
// ============================================================================

export interface JobCheckpoint<T = Record<string, unknown>> {
  jobId: string;
  jobType: string;
  progress: number; // 0-100
  lastProcessedId?: string;
  lastProcessedAt: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the checkpoint path for a job
 */
function getCheckpointPath(jobType: string, jobId: string): string {
  return `checkpoints/${jobType}/${jobId}.json`;
}

/**
 * Save a checkpoint for a long-running job
 */
export async function saveCheckpoint<T = Record<string, unknown>>(
  jobType: string,
  jobId: string,
  data: T,
  progress: number,
  lastProcessedId?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const key = getCheckpointPath(jobType, jobId);

  // Try to read existing checkpoint to preserve createdAt
  const existing = await readJson<JobCheckpoint<T>>(key);

  const checkpoint: JobCheckpoint<T> = {
    jobId,
    jobType,
    progress: Math.min(100, Math.max(0, progress)),
    lastProcessedId,
    lastProcessedAt: now,
    data,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const success = await writeJson(key, checkpoint);

  if (success) {
    console.log(
      'Checkpoint saved for %s/%s: %d%% complete',
      jobType,
      jobId,
      checkpoint.progress
    );
  }

  return success;
}

/**
 * Load a checkpoint for resuming a job
 */
export async function loadCheckpoint<T = Record<string, unknown>>(
  jobType: string,
  jobId: string
): Promise<JobCheckpoint<T> | null> {
  const key = getCheckpointPath(jobType, jobId);
  const checkpoint = await readJson<JobCheckpoint<T>>(key);

  if (checkpoint) {
    console.log(
      'Checkpoint loaded for %s/%s: %d%% complete, last processed: %s',
      jobType,
      jobId,
      checkpoint.progress,
      checkpoint.lastProcessedId || 'none'
    );
  }

  return checkpoint;
}

/**
 * Delete a checkpoint after job completion
 */
export async function deleteCheckpoint(jobType: string, jobId: string): Promise<boolean> {
  const key = getCheckpointPath(jobType, jobId);
  const success = await deleteFile(key);

  if (success) {
    console.log('Checkpoint deleted for %s/%s', jobType, jobId);
  }

  return success;
}

/**
 * Check if a checkpoint exists for a job
 */
export async function hasCheckpoint(jobType: string, jobId: string): Promise<boolean> {
  const key = getCheckpointPath(jobType, jobId);
  return await fileExists(key);
}

/**
 * List all checkpoints for a job type
 */
export async function listCheckpoints(jobType: string): Promise<string[]> {
  const dirPath = getStoragePath(`checkpoints/${jobType}`);
  const jobIds: string[] = [];

  try {
    for await (const entry of Deno.readDir(dirPath)) {
      if (entry.isFile && entry.name.endsWith('.json')) {
        jobIds.push(entry.name.replace('.json', ''));
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error('Error listing checkpoints for %s:', jobType, error);
    }
  }

  return jobIds;
}

// ============================================================================
// Config Management
// ============================================================================

export interface StorageConfig {
  [key: string]: unknown;
}

/**
 * Load config synchronously during initialization (97% faster)
 * WARNING: Only use during script initialization
 */
export function loadConfigSync<T extends StorageConfig>(configName: string): T | null {
  const key = `config/${configName}.json`;
  return readJsonSync<T>(key);
}

/**
 * Load config asynchronously
 */
export async function loadConfig<T extends StorageConfig>(configName: string): Promise<T | null> {
  const key = `config/${configName}.json`;
  return await readJson<T>(key);
}

/**
 * Save config
 */
export async function saveConfig<T extends StorageConfig>(
  configName: string,
  config: T
): Promise<boolean> {
  const key = `config/${configName}.json`;
  return await writeJson(key, config);
}

// ============================================================================
// Audit/Debug Logging
// ============================================================================

export interface AuditLogEntry {
  timestamp: string;
  jobType: string;
  jobId: string;
  action: string;
  details?: Record<string, unknown>;
}

/**
 * Append an entry to the audit log for a job
 */
export async function appendAuditLog(
  jobType: string,
  jobId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<boolean> {
  const key = `audit/${jobType}/${jobId}.jsonl`;
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    jobType,
    jobId,
    action,
    details,
  };

  try {
    const path = getStoragePath(key);
    const dir = path.substring(0, path.lastIndexOf('/'));
    await ensureDir(dir);

    // Append to file (JSONL format - one JSON object per line)
    const line = JSON.stringify(entry) + '\n';
    const file = await Deno.open(path, { write: true, create: true, append: true });
    const encoder = new TextEncoder();
    await file.write(encoder.encode(line));
    file.close();

    return true;
  } catch (error) {
    console.error('Error appending audit log for %s/%s:', jobType, jobId, error);
    return false;
  }
}

/**
 * Read audit log entries for a job
 */
export async function readAuditLog(
  jobType: string,
  jobId: string
): Promise<AuditLogEntry[]> {
  const key = `audit/${jobType}/${jobId}.jsonl`;
  const content = await readTextFile(key);

  if (!content) return [];

  const entries: AuditLogEntry[] = [];
  const lines = content.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}
