// Edge syncs should finish within minutes. An old row is not an active job.
export const SYNC_STALL_TIMEOUT_MS = 5 * 60 * 1000;

export function isSyncStalled(
  status: string | null,
  updatedAt: string | null,
  now = Date.now()
): boolean {
  if (status !== 'in_progress') return false;
  const updated = updatedAt ? Date.parse(updatedAt) : NaN;
  return !Number.isFinite(updated) || updated > now || now - updated >= SYNC_STALL_TIMEOUT_MS;
}
