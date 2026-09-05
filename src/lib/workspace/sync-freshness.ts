/**
 * Shared freshness rules for workspace PR and issue snapshots.
 */

export interface SyncedRow {
  last_synced_at: string | null;
  repository_id: string;
}

export interface Freshness {
  needsSync: boolean;
  /** When the least recently refreshed repository was last stored, or null if one has no rows. */
  oldestSync: Date | null;
}

/**
 * A repository is as fresh as its most recently synced row; old closed PRs that the
 * sync no longer touches must not make the whole workspace look stale. The workspace
 * is as stale as its least recently synced repository.
 */
export function summarizeFreshness(
  repoIds: string[],
  rows: SyncedRow[],
  maxStaleMinutes: number
): Freshness {
  const latestByRepo = new Map<string, number>();
  for (const row of rows) {
    const syncedAt = row.last_synced_at ? Date.parse(row.last_synced_at) : Number.NaN;
    if (Number.isNaN(syncedAt)) continue;
    const current = latestByRepo.get(row.repository_id);
    if (current === undefined || syncedAt > current) latestByRepo.set(row.repository_id, syncedAt);
  }
  if (repoIds.some((id) => !latestByRepo.has(id))) {
    return { needsSync: true, oldestSync: null };
  }
  const oldestSync = new Date(Math.min(...repoIds.map((id) => latestByRepo.get(id) as number)));
  const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);
  return { needsSync: minutesSinceSync > maxStaleMinutes, oldestSync };
}
