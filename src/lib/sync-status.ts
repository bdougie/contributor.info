// Edge syncs should finish within minutes. An old row is not an active job.
export const SYNC_STALL_TIMEOUT_MS = 5 * 60 * 1000;

// A failed sync is only worth reporting while it is recent. Older failed rows
// are history, not a live problem with the data currently on screen.
export const SYNC_FAILURE_VISIBLE_MS = 60 * 60 * 1000;

function parseTimestamp(value: string | null): number {
  return value ? Date.parse(value) : NaN;
}

export function isSyncStalled(
  status: string | null,
  updatedAt: string | null,
  now = Date.now()
): boolean {
  if (status !== 'in_progress') return false;
  const updated = parseTimestamp(updatedAt);
  return !Number.isFinite(updated) || updated > now || now - updated >= SYNC_STALL_TIMEOUT_MS;
}

export function isRecentSyncFailure(
  status: string | null,
  updatedAt: string | null,
  now = Date.now()
): boolean {
  if (status !== 'failed') return false;
  const updated = parseTimestamp(updatedAt);
  return Number.isFinite(updated) && updated <= now && now - updated < SYNC_FAILURE_VISIBLE_MS;
}

/** Error message to surface for a sync row, or null when the row is not a live failure. */
export function getSyncRowError(
  row: { sync_status: string | null; error_message: string | null; updated_at: string | null },
  now = Date.now()
): string | null {
  if (!isRecentSyncFailure(row.sync_status, row.updated_at, now)) return null;
  return row.error_message || 'The latest repository update failed.';
}
