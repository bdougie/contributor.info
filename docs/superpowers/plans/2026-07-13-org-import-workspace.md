# Org Import into Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user opt an entire GitHub org's repos (e.g. `papercomputeco`) into a workspace in one action via an "Import from org" tab in the Add Repository modal.

**Architecture:** A new pure-helper module maps/filters/caps org repos; a new hook lists an org's repos via paginated Octokit (user OAuth token surfaces private repos) and checks the org's GitHub App installation; a new bulk `WorkspaceService.addRepositoriesToWorkspace` inserts all junction rows in one query and fires one Inngest event batch; the modal gains an org tab whose checkboxes feed the existing staging cart, and submit tracks repos through the existing `/api/track-repository` with a small concurrency pool.

**Tech Stack:** React 18 + TypeScript, Supabase JS, Octokit (`@octokit/rest`), Inngest, vitest, shadcn UI primitives (`tabs`, `checkbox`, `switch` already exist in `src/components/ui/`).

**Spec:** `docs/superpowers/specs/2026-07-13-org-import-workspace-design.md`

## Global Constraints

- vitest only — never jest.
- Never use `any` or `unknown` types — define real interfaces.
- Never write env variables inline into scripts (especially SUPABASE tokens/keys/urls).
- `console.log(`${owner}`)` is a security vulnerability — use `console.log('%s', owner)`.
- ES module patterns only — no `require()`.
- Testing follows `docs/testing/bulletproof-testing-guidelines.md`: prefer pure-function tests; mock all network; no `waitFor`; keep test files small and fast. (Existing `src/services/__tests__/workspace.service.test.ts` establishes the accepted mocked-supabase async pattern for service tests — follow it.)
- Run tests with `npx vitest run <file>`; full build check with `npm run build`.

---

### Task 1: Pure org-import helpers

**Files:**
- Create: `src/lib/utils/org-import.ts`
- Test: `src/lib/utils/org-import.test.ts`

**Interfaces:**
- Consumes: `GitHubRepository` from `@/lib/github` (fields: `id: number, name, full_name, owner: {login, avatar_url}, description, stargazers_count, forks_count, private, pushed_at?, language?`).
- Produces (used by Tasks 4 and 5):
  - `interface OrgImportRepo { githubId: number; name: string; fullName: string; owner: string; description: string | null; stargazersCount: number; language: string | null; pushedAt: string | null; isPrivate: boolean; isFork: boolean; isArchived: boolean; avatarUrl: string }`
  - `interface OctokitOrgRepo` (raw listForOrg item shape we consume)
  - `toOrgImportRepo(repo: OctokitOrgRepo): OrgImportRepo`
  - `filterEligible(repos: OrgImportRepo[], showForksAndArchived: boolean): OrgImportRepo[]`
  - `sortByMostRecentlyPushed(repos: OrgImportRepo[]): OrgImportRepo[]`
  - `capSelection(repos: OrgImportRepo[], remainingSlots: number): OrgImportRepo[]`
  - `toStagedRepository(repo: OrgImportRepo): GitHubRepository`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/org-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  toOrgImportRepo,
  filterEligible,
  sortByMostRecentlyPushed,
  capSelection,
  toStagedRepository,
  type OctokitOrgRepo,
  type OrgImportRepo,
} from './org-import';

function makeRepo(overrides: Partial<OrgImportRepo> = {}): OrgImportRepo {
  return {
    githubId: 1,
    name: 'repo',
    fullName: 'acme/repo',
    owner: 'acme',
    description: null,
    stargazersCount: 0,
    language: null,
    pushedAt: '2026-01-01T00:00:00Z',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    avatarUrl: 'https://github.com/acme.png',
    ...overrides,
  };
}

describe('toOrgImportRepo', () => {
  it('maps octokit fields and fills defaults for missing optionals', () => {
    const raw: OctokitOrgRepo = {
      id: 42,
      name: 'widgets',
      full_name: 'acme/widgets',
      owner: { login: 'acme', avatar_url: 'https://avatars.example/acme' },
      description: 'A repo',
      stargazers_count: 7,
      language: 'TypeScript',
      pushed_at: '2026-06-01T00:00:00Z',
      private: true,
      fork: false,
      archived: false,
    };
    const mapped = toOrgImportRepo(raw);
    expect(mapped.githubId).toBe(42);
    expect(mapped.fullName).toBe('acme/widgets');
    expect(mapped.owner).toBe('acme');
    expect(mapped.isPrivate).toBe(true);
    expect(mapped.stargazersCount).toBe(7);
    expect(mapped.avatarUrl).toBe('https://avatars.example/acme');
  });

  it('falls back to owner login from full_name and github avatar when owner is missing', () => {
    const raw: OctokitOrgRepo = { id: 1, name: 'x', full_name: 'acme/x' };
    const mapped = toOrgImportRepo(raw);
    expect(mapped.owner).toBe('acme');
    expect(mapped.avatarUrl).toBe('https://github.com/acme.png');
    expect(mapped.stargazersCount).toBe(0);
    expect(mapped.pushedAt).toBeNull();
  });
});

describe('filterEligible', () => {
  const repos = [
    makeRepo({ fullName: 'a/source' }),
    makeRepo({ fullName: 'a/fork', isFork: true }),
    makeRepo({ fullName: 'a/archived', isArchived: true }),
  ];

  it('hides forks and archived repos by default', () => {
    expect(filterEligible(repos, false).map((r) => r.fullName)).toEqual(['a/source']);
  });

  it('includes forks and archived repos when toggled on', () => {
    expect(filterEligible(repos, true)).toHaveLength(3);
  });
});

describe('sortByMostRecentlyPushed', () => {
  it('sorts descending by pushedAt with null last, without mutating input', () => {
    const older = makeRepo({ fullName: 'a/older', pushedAt: '2025-01-01T00:00:00Z' });
    const newer = makeRepo({ fullName: 'a/newer', pushedAt: '2026-06-01T00:00:00Z' });
    const never = makeRepo({ fullName: 'a/never', pushedAt: null });
    const input = [older, never, newer];
    const sorted = sortByMostRecentlyPushed(input);
    expect(sorted.map((r) => r.fullName)).toEqual(['a/newer', 'a/older', 'a/never']);
    expect(input[0].fullName).toBe('a/older');
  });
});

describe('capSelection', () => {
  it('returns the first N repos when over the cap', () => {
    const repos = [makeRepo({ fullName: 'a/1' }), makeRepo({ fullName: 'a/2' }), makeRepo({ fullName: 'a/3' })];
    expect(capSelection(repos, 2).map((r) => r.fullName)).toEqual(['a/1', 'a/2']);
  });

  it('returns all repos when under the cap and none when slots are 0 or negative', () => {
    const repos = [makeRepo()];
    expect(capSelection(repos, 5)).toHaveLength(1);
    expect(capSelection(repos, 0)).toHaveLength(0);
    expect(capSelection(repos, -1)).toHaveLength(0);
  });
});

describe('toStagedRepository', () => {
  it('converts to the GitHubRepository shape used by the staging cart', () => {
    const staged = toStagedRepository(
      makeRepo({ githubId: 9, fullName: 'acme/widgets', name: 'widgets', isPrivate: true, stargazersCount: 3 })
    );
    expect(staged.id).toBe(9);
    expect(staged.full_name).toBe('acme/widgets');
    expect(staged.owner.login).toBe('acme');
    expect(staged.private).toBe(true);
    expect(staged.stargazers_count).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/org-import.test.ts`
Expected: FAIL — `Cannot find module './org-import'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `src/lib/utils/org-import.ts`:

```typescript
/**
 * Pure helpers for the workspace "Import from org" flow: mapping raw
 * GitHub org-repo listings into a display shape, eligibility filtering,
 * recency sorting, and capping selection to remaining workspace slots.
 */
import type { GitHubRepository } from '@/lib/github';

/** Raw shape we consume from octokit repos.listForOrg items */
export interface OctokitOrgRepo {
  id: number;
  name: string;
  full_name: string;
  owner?: { login?: string; avatar_url?: string } | null;
  description?: string | null;
  stargazers_count?: number;
  language?: string | null;
  pushed_at?: string | null;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
}

export interface OrgImportRepo {
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  stargazersCount: number;
  language: string | null;
  pushedAt: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  avatarUrl: string;
}

export function toOrgImportRepo(repo: OctokitOrgRepo): OrgImportRepo {
  const owner = repo.owner?.login || repo.full_name.split('/')[0] || '';
  return {
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner,
    description: repo.description ?? null,
    stargazersCount: repo.stargazers_count ?? 0,
    language: repo.language ?? null,
    pushedAt: repo.pushed_at ?? null,
    isPrivate: repo.private ?? false,
    isFork: repo.fork ?? false,
    isArchived: repo.archived ?? false,
    avatarUrl: repo.owner?.avatar_url || `https://github.com/${owner}.png`,
  };
}

export function filterEligible(
  repos: OrgImportRepo[],
  showForksAndArchived: boolean
): OrgImportRepo[] {
  if (showForksAndArchived) return repos;
  return repos.filter((repo) => !repo.isFork && !repo.isArchived);
}

export function sortByMostRecentlyPushed(repos: OrgImportRepo[]): OrgImportRepo[] {
  return [...repos].sort((a, b) => {
    const aTime = a.pushedAt ? new Date(a.pushedAt).getTime() : 0;
    const bTime = b.pushedAt ? new Date(b.pushedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export function capSelection(repos: OrgImportRepo[], remainingSlots: number): OrgImportRepo[] {
  if (remainingSlots <= 0) return [];
  return repos.slice(0, remainingSlots);
}

/** Convert to the GitHubRepository shape the AddRepositoryModal staging cart uses */
export function toStagedRepository(repo: OrgImportRepo): GitHubRepository {
  return {
    id: repo.githubId,
    name: repo.name,
    full_name: repo.fullName,
    owner: { login: repo.owner, avatar_url: repo.avatarUrl },
    description: repo.description,
    stargazers_count: repo.stargazersCount,
    forks_count: 0,
    private: repo.isPrivate,
    pushed_at: repo.pushedAt ?? undefined,
    language: repo.language,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/org-import.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/org-import.ts src/lib/utils/org-import.test.ts
git commit -m "feat: add pure helpers for workspace org import"
```

---

### Task 2: mapWithConcurrency util

**Files:**
- Create: `src/lib/utils/concurrency.ts`
- Test: `src/lib/utils/concurrency.test.ts`

**Interfaces:**
- Produces (used by Task 5): `mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>` — results in input order; `fn` rejections propagate (callers already wrap per-item work in try/catch).

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/concurrency.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('maps all items and preserves input order', async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (n) => n * 10);
    expect(results).toEqual([30, 10, 20]);
  });

  it('never runs more than the limit concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      await Promise.resolve();
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('returns an empty array for empty input', async () => {
    const results = await mapWithConcurrency([], 4, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it('passes the item index to the mapper', async () => {
    const results = await mapWithConcurrency(['a', 'b'], 1, async (item, index) => `${item}${index}`);
    expect(results).toEqual(['a0', 'b1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/concurrency.test.ts`
Expected: FAIL — cannot resolve `./concurrency`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/utils/concurrency.ts`:

```typescript
/**
 * Map over items with a bounded number of in-flight promises.
 * Results are returned in input order. Rejections from the mapper
 * propagate to the returned promise.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  };

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/concurrency.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/concurrency.ts src/lib/utils/concurrency.test.ts
git commit -m "feat: add mapWithConcurrency util for bounded parallel work"
```

---

### Task 3: WorkspaceService.addRepositoriesToWorkspace (bulk add)

**Files:**
- Modify: `src/services/workspace.service.ts` (add new static method directly after `addRepositoryToWorkspace`, which ends around line 826)
- Test: `src/services/__tests__/workspace-bulk-add.test.ts` (new focused file — do NOT grow the existing 1350-line `workspace.service.test.ts`)

**Interfaces:**
- Consumes: existing `WorkspaceService.checkPermission(workspaceId, userId, roles)` (returns `{ hasPermission: boolean; role?: WorkspaceRole }`), `getSupabase()` from `@/lib/supabase-lazy`, `workspacePrioritySync.markAsWorkspaceRepo(repositoryId)`, `inngest.send()`, `logError()` — all already imported in the file.
- Produces (used by Task 5):
  `static async addRepositoriesToWorkspace(workspaceId: string, userId: string, repositoryIds: string[]): Promise<ServiceResponse<{ added: string[]; skipped: string[] }>>`
  where `added` = repository ids newly inserted, `skipped` = ids already in the workspace. `ServiceResponse<T>` is `{ success: boolean; data?: T; error?: string; statusCode?: number }` (defined in the same file).

**Event note (verified against consumers):** `workspace/priorities.sync` (`sync-workspace-priorities.ts`) ignores event data and runs a full sync — one event per batch is safe. `workspace.repository.changed` (`aggregate-workspace-metrics.ts`) debounces per `workspaceId` and uses `repositoryId`/`repositoryName` only for logging — one summary event per batch is safe.

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/workspace-bulk-add.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import { getSupabase } from '@/lib/supabase-lazy';
import { inngest } from '@/lib/inngest/client';
import { workspacePrioritySync } from '@/lib/progressive-capture/workspace-priority-sync';
import type { MockQueryBuilder } from './test-types';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('@/lib/progressive-capture/workspace-priority-sync', () => ({
  workspacePrioritySync: {
    markAsWorkspaceRepo: vi.fn().mockResolvedValue(undefined),
  },
  WorkspacePrioritySync: vi.fn(),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
  },
}));

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';
const REPO_A = '11111111-1111-4111-8111-111111111111';
const REPO_B = '22222222-2222-4222-8222-222222222222';

/**
 * Build a supabase.from mock for the bulk-add happy path / limit path.
 * Tables hit in order:
 *  1. workspace_repositories.select('repository_id').eq().in()  -> existing rows
 *  2. workspaces.select('max_repositories').eq().maybeSingle()  -> workspace
 *  3. workspace_repositories.select(count head).eq()            -> current count
 *  4. workspace_repositories.insert([...])                      -> insert
 *  5. workspace_repositories.select(count head).eq()            -> new count
 *  6. workspaces.update().eq()                                  -> counter resync
 *  7. repositories.select('full_name').eq().maybeSingle()       -> event name
 */
function setupFromMock(opts: {
  existingRepoIds: string[];
  maxRepositories: number;
  currentCount: number;
  insertError?: { message: string } | null;
}) {
  const insertMock = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  let workspaceRepoSelectCalls = 0;

  vi.mocked(supabase.from).mockImplementation((table: string): MockQueryBuilder => {
    if (table === 'workspace_repositories') {
      return {
        select: vi.fn().mockImplementation(() => {
          workspaceRepoSelectCalls++;
          if (workspaceRepoSelectCalls === 1) {
            // duplicate check: .eq().in()
            return {
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: opts.existingRepoIds.map((id) => ({ repository_id: id })),
                  error: null,
                }),
              }),
            };
          }
          // count checks: .eq() resolves with { count }
          return {
            eq: vi.fn().mockResolvedValue({
              count: opts.currentCount,
              error: null,
            }),
          };
        }),
        insert: insertMock,
      } as MockQueryBuilder;
    }
    if (table === 'workspaces') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { max_repositories: opts.maxRepositories },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as MockQueryBuilder;
    }
    if (table === 'repositories') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: 'acme/widgets' },
              error: null,
            }),
          }),
        }),
      } as MockQueryBuilder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { insertMock };
}

describe('WorkspaceService.addRepositoriesToWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockResolvedValue(supabase);
    vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({
      hasPermission: true,
      role: 'owner',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an empty repository list', async () => {
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, []);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects when the user lacks permission', async () => {
    vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({ hasPermission: false });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it('skips repositories already in the workspace without inserting', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [REPO_A],
      maxRepositories: 10,
      currentCount: 1,
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ added: [], skipped: [REPO_A] });
    expect(insertMock).not.toHaveBeenCalled();
    expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
  });

  it('rejects when the batch would exceed the workspace limit', async () => {
    setupFromMock({ existingRepoIds: [], maxRepositories: 3, currentCount: 2 });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
      REPO_B,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toContain('limit');
  });

  it('inserts new repositories in one batch and fires one event of each type', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [REPO_A],
      maxRepositories: 10,
      currentCount: 1,
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
      REPO_B,
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ added: [REPO_B], skipped: [REPO_A] });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([
      {
        workspace_id: WORKSPACE_ID,
        repository_id: REPO_B,
        added_by: USER_ID,
        notes: null,
        tags: [],
        is_pinned: false,
      },
    ]);
    expect(vi.mocked(workspacePrioritySync.markAsWorkspaceRepo)).toHaveBeenCalledWith(REPO_B);
    const eventNames = vi.mocked(inngest.send).mock.calls.map((call) => {
      const payload = call[0] as { name: string };
      return payload.name;
    });
    expect(eventNames).toEqual(['workspace/priorities.sync', 'workspace.repository.changed']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/__tests__/workspace-bulk-add.test.ts`
Expected: FAIL — `WorkspaceService.addRepositoriesToWorkspace is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/services/workspace.service.ts`, insert the following method immediately after the closing brace of `addRepositoryToWorkspace` (after the `return { success: false, error: 'Failed to add repository to workspace', statusCode: 500 };` catch block, ~line 826) and before the `removeRepositoryFromWorkspace` doc comment:

```typescript
  /**
   * Add multiple repositories to a workspace in one operation (org import).
   * Repositories already in the workspace are skipped, the limit is checked
   * once for the whole batch, and background sync events fire once per batch
   * instead of once per repository. The DB trigger on workspace_repositories
   * remains the final guard against limit races.
   */
  static async addRepositoriesToWorkspace(
    workspaceId: string,
    userId: string,
    repositoryIds: string[]
  ): Promise<ServiceResponse<{ added: string[]; skipped: string[] }>> {
    try {
      if (repositoryIds.length === 0) {
        return {
          success: false,
          error: 'No repositories provided',
          statusCode: 400,
        };
      }

      const supabase = await getSupabase();

      const permission = await this.checkPermission(workspaceId, userId, [
        'owner',
        'admin',
        'maintainer',
      ]);
      if (!permission.hasPermission) {
        return {
          success: false,
          error:
            'Insufficient permissions to add repositories. Required: owner, admin, or maintainer.',
          statusCode: 403,
        };
      }

      // Skip repositories already in the workspace
      const uniqueIds = [...new Set(repositoryIds)];
      const { data: existingRows } = await supabase
        .from('workspace_repositories')
        .select('repository_id')
        .eq('workspace_id', workspaceId)
        .in('repository_id', uniqueIds);

      const existingIds = new Set(
        (existingRows ?? []).map((row: { repository_id: string }) => row.repository_id)
      );
      const newIds = uniqueIds.filter((id) => !existingIds.has(id));
      const skipped = uniqueIds.filter((id) => existingIds.has(id));

      if (newIds.length === 0) {
        return {
          success: true,
          data: { added: [], skipped },
          statusCode: 200,
        };
      }

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('max_repositories')
        .eq('id', workspaceId)
        .maybeSingle();

      if (!workspace) {
        return {
          success: false,
          error: 'Workspace not found',
          statusCode: 404,
        };
      }

      // Check the batch against the limit using actual row count
      const { count: currentCount } = await supabase
        .from('workspace_repositories')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      if ((currentCount ?? 0) + newIds.length > workspace.max_repositories) {
        const remaining = Math.max(0, workspace.max_repositories - (currentCount ?? 0));
        return {
          success: false,
          error: `Adding ${newIds.length} repositories would exceed the workspace limit of ${workspace.max_repositories}. Only ${remaining} slot${remaining === 1 ? '' : 's'} remaining.`,
          statusCode: 403,
        };
      }

      const { error: insertError } = await supabase.from('workspace_repositories').insert(
        newIds.map((repositoryId) => ({
          workspace_id: workspaceId,
          repository_id: repositoryId,
          added_by: userId,
          notes: null,
          tags: [],
          is_pinned: false,
        }))
      );

      if (insertError) {
        throw insertError;
      }

      // Sync workspace repository count from actual rows
      const { count: newCount } = await supabase
        .from('workspace_repositories')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      await supabase
        .from('workspaces')
        .update({
          current_repository_count: newCount ?? (currentCount ?? 0) + newIds.length,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', workspaceId);

      // Upgrade priorities per repo, but fire only one sync event for the
      // batch — the handler ignores event data and runs a full sync
      try {
        for (const repositoryId of newIds) {
          await workspacePrioritySync.markAsWorkspaceRepo(repositoryId);
        }
        await inngest.send({
          name: 'workspace/priorities.sync',
          data: {
            repositoryId: newIds[0],
            trigger: 'workspace_add',
            workspaceId,
          },
        });
      } catch (error) {
        logError('Failed to update repository priorities', error, {
          tags: { feature: 'workspace', operation: 'bulk_add_repositories' },
          extra: { workspaceId, repositoryIds: newIds },
        });
      }

      // One metrics event for the batch — the handler debounces per
      // workspace and uses repositoryId/Name only for logging
      try {
        const { data: firstRepo } = await supabase
          .from('repositories')
          .select('full_name')
          .eq('id', newIds[0])
          .maybeSingle();

        const firstName = firstRepo?.full_name ?? `${newIds.length} repositories`;
        await inngest.send({
          name: 'workspace.repository.changed',
          data: {
            workspaceId,
            action: 'added',
            repositoryId: newIds[0],
            repositoryName:
              newIds.length > 1 ? `${firstName} (+${newIds.length - 1} more)` : firstName,
          },
        });
      } catch (error) {
        logError('Failed to trigger workspace metrics update', error, {
          tags: { feature: 'workspace', operation: 'bulk_add_repositories' },
          extra: { workspaceId, repositoryIds: newIds },
        });
      }

      return {
        success: true,
        data: { added: newIds, skipped },
        statusCode: 201,
      };
    } catch (error) {
      logError('Bulk add repositories to workspace error', error, {
        tags: { feature: 'workspace', operation: 'bulk_add_repositories' },
        extra: { workspaceId, userId, repositoryCount: repositoryIds.length },
      });
      return {
        success: false,
        error: 'Failed to add repositories to workspace',
        statusCode: 500,
      };
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/__tests__/workspace-bulk-add.test.ts`
Expected: PASS (5 tests).

Also run the existing service tests to confirm nothing broke:
Run: `npx vitest run src/services/__tests__/workspace.service.test.ts`
Expected: PASS (same count as before the change).

- [ ] **Step 5: Commit**

```bash
git add src/services/workspace.service.ts src/services/__tests__/workspace-bulk-add.test.ts
git commit -m "feat: add bulk addRepositoriesToWorkspace service method"
```

---

### Task 4: useOrgReposForImport hook

**Files:**
- Create: `src/hooks/use-org-repos-for-import.ts`

**Interfaces:**
- Consumes: `toOrgImportRepo`, `sortByMostRecentlyPushed`, `OrgImportRepo`, `OctokitOrgRepo` from `@/lib/utils/org-import` (Task 1); `getSupabase` from `@/lib/supabase-lazy`; `Octokit` from `@octokit/rest`; `env` from `@/lib/env`.
- Produces (used by Task 5):
  `useOrgReposForImport(org: string | null): { repos: OrgImportRepo[]; appInstalled: boolean; isLoading: boolean; error: string | null }`
  - `repos` — up to 200 repos, all types (public/private/fork/archived), sorted most-recently-pushed first. Filtering happens in the component via Task 1 helpers.
  - `appInstalled` — true when the org has an active GitHub App installation row (`github_app_installations` where `account_name` matches, not deleted/suspended). Gates selecting private repos.

No unit test for this file: it is a thin fetch wrapper; all decision logic lives in the Task 1 pure helpers, per the bulletproof testing guidelines (mock-heavy async hook tests are the pattern the guidelines forbid). It is exercised by the Task 6 build + manual verification.

- [ ] **Step 1: Write the implementation**

Create `src/hooks/use-org-repos-for-import.ts`:

```typescript
import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import { getSupabase } from '@/lib/supabase-lazy';
import { env } from '@/lib/env';
import {
  toOrgImportRepo,
  sortByMostRecentlyPushed,
  type OrgImportRepo,
  type OctokitOrgRepo,
} from '@/lib/utils/org-import';

const MAX_ORG_REPOS = 200;
const PER_PAGE = 100;

export interface UseOrgReposForImportState {
  repos: OrgImportRepo[];
  appInstalled: boolean;
  isLoading: boolean;
  error: string | null;
}

const IDLE_STATE: UseOrgReposForImportState = {
  repos: [],
  appInstalled: false,
  isLoading: false,
  error: null,
};

/**
 * List an org's repositories for the workspace import flow.
 *
 * Uses the signed-in user's GitHub OAuth token when available so private
 * repos they can see are included; falls back to the public app token.
 * Also reports whether the org has an active contributor.info GitHub App
 * installation, which gates tracking private repositories.
 */
export function useOrgReposForImport(org: string | null): UseOrgReposForImportState {
  const [state, setState] = useState<UseOrgReposForImportState>(IDLE_STATE);

  useEffect(() => {
    if (!org) {
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;

    const fetchOrgRepos = async () => {
      setState({ repos: [], appInstalled: false, isLoading: true, error: null });

      try {
        const supabase = await getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const octokit = new Octokit({
          auth: session?.provider_token || env.GITHUB_TOKEN,
        });

        const rawRepos: OctokitOrgRepo[] = [];
        for (let page = 1; rawRepos.length < MAX_ORG_REPOS; page++) {
          const { data } = await octokit.rest.repos.listForOrg({
            org,
            type: 'all',
            sort: 'pushed',
            direction: 'desc',
            per_page: PER_PAGE,
            page,
          });
          rawRepos.push(...data);
          if (data.length < PER_PAGE) break;
        }

        // Active org-wide GitHub App installation gates private-repo tracking
        const { data: installations } = await supabase
          .from('github_app_installations')
          .select('id')
          .ilike('account_name', org)
          .is('deleted_at', null)
          .is('suspended_at', null)
          .limit(1);

        if (cancelled) return;

        setState({
          repos: sortByMostRecentlyPushed(
            rawRepos.slice(0, MAX_ORG_REPOS).map(toOrgImportRepo)
          ),
          appInstalled: Boolean(installations && installations.length > 0),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        let message = 'Failed to fetch organization repositories';
        if (err && typeof err === 'object' && 'status' in err) {
          const status = (err as { status: number }).status;
          if (status === 404) {
            message = `Organization "${org}" not found`;
          } else if (status === 403) {
            message = 'GitHub rate limit exceeded. Please try again later.';
          }
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }

        setState({ repos: [], appInstalled: false, isLoading: false, error: message });
      }
    };

    fetchOrgRepos();

    return () => {
      cancelled = true;
    };
  }, [org]);

  return state;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep use-org-repos-for-import`
Expected: no output (no type errors in the new file). If the project's tsconfig layout makes this slow, `npm run build` in Task 6 is the backstop; still fix any errors surfaced here.

Note: the octokit `listForOrg` item type is structurally wider than `OctokitOrgRepo`; pushing `...data` into `OctokitOrgRepo[]` is valid because `OctokitOrgRepo` only names fields octokit provides. If tsc complains about `null` vs `undefined` on optionals, adjust `OctokitOrgRepo` field types in `org-import.ts` to accept both (e.g. `description?: string | null`) — they already do.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-org-repos-for-import.ts
git commit -m "feat: add useOrgReposForImport hook with pagination and app-install check"
```

---

### Task 5: "Import from org" tab in AddRepositoryModal + bulk submit

**Files:**
- Modify: `src/components/features/workspace/AddRepositoryModal.tsx`

**Interfaces:**
- Consumes: `useOrgReposForImport` (Task 4), `filterEligible` / `capSelection` / `toStagedRepository` / `OrgImportRepo` (Task 1), `mapWithConcurrency` (Task 2), `WorkspaceService.addRepositoriesToWorkspace` (Task 3), existing UI primitives `Tabs, TabsContent, TabsList, TabsTrigger` from `@/components/ui/tabs`, `Checkbox` from `@/components/ui/checkbox`, `Switch` from `@/components/ui/switch`, `Label` from `@/components/ui/label`.
- Produces: no new exports — modal behavior only.

Behavior summary:
1. The "Search Section" (lines ~633–671) is wrapped in a `Tabs` with two triggers: **Search** and **Import from org**.
2. Org tab: org-name input + Load button → repo checklist. Checkbox checked = repo is in the staging cart (`stagedRepos` stays the single source of truth). On first successful load per org, eligible repos are auto-staged up to remaining slots.
3. Disabled rows: already in workspace ("Added"), private without app installed (greyed, install link shown above list).
4. Forks/archived hidden behind a Switch.
5. Submit: tracking runs through `mapWithConcurrency(stagedRepos, 4, ...)` instead of unbounded `Promise.all`, and the per-repo `addRepositoryToWorkspace` loop is replaced with one `addRepositoriesToWorkspace` call. (The dropped `notes`/`tags`/`is_pinned` fields were never set by this modal, so behavior is preserved.)

- [ ] **Step 1: Add imports and state**

At the top of `AddRepositoryModal.tsx`, extend the existing imports (`useRef` joins the existing react import):

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useOrgReposForImport } from '@/hooks/use-org-repos-for-import';
import {
  filterEligible,
  capSelection,
  toStagedRepository,
  type OrgImportRepo,
} from '@/lib/utils/org-import';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
```

Inside the component, after the existing `privateRepoInput` state (line ~125), add:

```typescript
  // Org import tab state
  const [orgInput, setOrgInput] = useState('');
  const [orgQuery, setOrgQuery] = useState<string | null>(null);
  const [showForksArchived, setShowForksArchived] = useState(false);
  const autoStagedOrgRef = useRef<string | null>(null);
  const {
    repos: orgRepos,
    appInstalled: orgAppInstalled,
    isLoading: orgLoading,
    error: orgError,
  } = useOrgReposForImport(orgQuery);
```

- [ ] **Step 2: Add org-tab callbacks and the auto-stage effect**

After `handleAddPrivateRepo` (line ~305), add:

```typescript
  /** A repo row can be checked when it isn't already in the workspace and,
   * if private, the org has the GitHub App installed. */
  const isOrgRepoSelectable = useCallback(
    (repo: OrgImportRepo) =>
      !existingRepoIds.has(repo.fullName) && (!repo.isPrivate || orgAppInstalled),
    [existingRepoIds, orgAppInstalled]
  );

  const handleToggleOrgRepo = useCallback(
    (repo: OrgImportRepo, checked: boolean) => {
      if (checked) {
        handleSelectRepository(toStagedRepository(repo));
      } else {
        setStagedRepos((prev) => prev.filter((r) => r.full_name !== repo.fullName));
      }
    },
    [handleSelectRepository]
  );

  const handleLoadOrg = useCallback(() => {
    const trimmed = orgInput.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      setError('Enter a GitHub organization name, e.g. papercomputeco');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setOrgQuery(trimmed);
  }, [orgInput]);

  // Pre-select the org's eligible repos (most recently pushed first) up to
  // the remaining workspace slots, once per loaded org
  useEffect(() => {
    if (!orgQuery || orgLoading || orgRepos.length === 0) return;
    if (autoStagedOrgRef.current === orgQuery) return;
    autoStagedOrgRef.current = orgQuery;

    setStagedRepos((prev) => {
      const stagedNames = new Set(prev.map((r) => r.full_name));
      const eligible = filterEligible(orgRepos, false).filter(
        (repo) =>
          isOrgRepoSelectable(repo) && !stagedNames.has(repo.fullName)
      );
      const slotsLeft = remainingSlots - prev.length;
      const toStage = capSelection(eligible, slotsLeft);
      if (toStage.length === 0) return prev;
      toast.success(`Selected ${toStage.length} repositories from ${orgQuery}`);
      return [...prev, ...toStage.map(toStagedRepository)];
    });
  }, [orgQuery, orgLoading, orgRepos, isOrgRepoSelectable, remainingSlots]);
```

- [ ] **Step 3: Wrap the search section in tabs and add the org tab JSX**

Replace the existing "Search Section" block (the `<div className="space-y-2">` containing the `GitHubSearchInput`, the private-repo `Input` row, and the closing `</p>` about private repositories — lines ~633–671) with:

```tsx
        {/* Add repositories: search or org import */}
        <Tabs defaultValue="search">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="org">Import from org</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-2">
            <GitHubSearchInput
              placeholder="Search for repositories (e.g., facebook/react)"
              onSearch={(query) => {
                // This is for manual search submission
                console.log('%s', `Manual search: ${query}`);
              }}
              onSelect={handleSelectRepository}
              showButton={false}
            />
            <div className="flex gap-2">
              <Input
                value={privateRepoInput}
                onChange={(e) => setPrivateRepoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPrivateRepo();
                  }
                }}
                placeholder="owner/repo"
                aria-label="Add a private repository by owner/name"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPrivateRepo}
                disabled={!privateRepoInput.trim()}
              >
                Add private repo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Private repositories don't appear in search. Enter owner/name directly — tracking
              them requires installing the contributor.info GitHub App.
            </p>
          </TabsContent>

          <TabsContent value="org" className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLoadOrg();
                  }
                }}
                placeholder="Organization name (e.g. papercomputeco)"
                aria-label="GitHub organization name"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadOrg}
                disabled={!orgInput.trim() || orgLoading}
              >
                {orgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load repos'}
              </Button>
            </div>

            {orgError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{orgError}</AlertDescription>
              </Alert>
            )}

            {orgQuery && !orgLoading && !orgError && (
              <>
                {orgRepos.some((r) => r.isPrivate) && !orgAppInstalled && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        Private repositories in {orgQuery} need the contributor.info GitHub App
                        installed on the org before they can be added.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-fit gap-1"
                        onClick={() =>
                          window.open(GITHUB_APP_INSTALL_URL, '_blank', 'noopener,noreferrer')
                        }
                      >
                        Install GitHub App
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {filterEligible(orgRepos, showForksArchived).length} repositories in{' '}
                    {orgQuery}
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-forks-archived"
                      checked={showForksArchived}
                      onCheckedChange={setShowForksArchived}
                    />
                    <Label htmlFor="show-forks-archived" className="text-xs">
                      Show forks & archived
                    </Label>
                  </div>
                </div>

                <ScrollArea className="h-[180px] pr-4 border rounded-lg p-2">
                  <div className="space-y-1">
                    {filterEligible(orgRepos, showForksArchived).map((repo) => {
                      const inWorkspace = existingRepoIds.has(repo.fullName);
                      const isStaged = stagedRepos.some((r) => r.full_name === repo.fullName);
                      const selectable = isOrgRepoSelectable(repo);
                      return (
                        <div
                          key={repo.fullName}
                          className={`flex items-center gap-2 p-1.5 rounded ${
                            selectable ? '' : 'opacity-50'
                          }`}
                        >
                          <Checkbox
                            id={`org-repo-${repo.fullName}`}
                            checked={isStaged || inWorkspace}
                            disabled={!selectable || (!isStaged && !canAddMore)}
                            onCheckedChange={(checked) =>
                              handleToggleOrgRepo(repo, checked === true)
                            }
                            aria-label={`Select ${repo.fullName}`}
                          />
                          <label
                            htmlFor={`org-repo-${repo.fullName}`}
                            className="flex-1 min-w-0 flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <span className="truncate font-medium">{repo.name}</span>
                            {repo.isPrivate && (
                              <Badge variant="outline" className="text-xs">
                                private
                              </Badge>
                            )}
                            {repo.isFork && (
                              <Badge variant="secondary" className="text-xs">
                                fork
                              </Badge>
                            )}
                            {repo.isArchived && (
                              <Badge variant="secondary" className="text-xs">
                                archived
                              </Badge>
                            )}
                            {inWorkspace && (
                              <Badge variant="secondary" className="text-xs">
                                added
                              </Badge>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                              <Star className="h-3 w-3" />
                              {repo.stargazersCount.toLocaleString()}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
```

- [ ] **Step 4: Bound tracking concurrency and switch submit to the bulk service call**

In `handleSubmit`, replace the unbounded `Promise.all(stagedRepos.map(...))` (lines ~497–518) with `mapWithConcurrency` — same mapper body, limit 4:

```typescript
      // Track and resolve all repositories (starts tracking for untracked
      // repos), at most 4 in flight to stay under GitHub/API rate limits
      const repoResults = await mapWithConcurrency(stagedRepos, 4, async (
        repo
      ): Promise<{
        id: string | null;
        error: string | null;
        trackingError?: unknown;
        repo: StagedRepository;
      }> => {
        try {
          const id = await trackAndResolveRepository(supabase, repo);
          return { id, error: null, repo };
        } catch (err) {
          const message =
            err instanceof Error ? err.message : `Failed to set up ${repo.full_name}`;
          console.error('Error tracking repository %s:', repo.full_name, err);
          return { id: null, error: message, trackingError: err, repo };
        }
      });
```

Then replace the per-repo add loop (lines ~539–558, the `let successCount = 0; ... for (const { id: repoId, repo: stagedRepo } of resolved) { ... }` block) with one bulk call:

```typescript
      // Add all resolved repositories to the workspace in one batch
      let successCount = 0;
      const errors: string[] = failed
        .filter((r) => !installFailures.includes(r))
        .map((r) => r.error!);

      if (resolved.length > 0) {
        const response = await WorkspaceService.addRepositoriesToWorkspace(
          workspaceId,
          appUserId,
          resolved.map((r) => r.id)
        );

        if (response.success && response.data) {
          successCount = response.data.added.length;
          if (response.data.skipped.length > 0) {
            errors.push(
              `${response.data.skipped.length} ${response.data.skipped.length === 1 ? 'repository was' : 'repositories were'} already in this workspace`
            );
          }
        } else {
          errors.push(response.error || 'Failed to add repositories to workspace');
        }
      }
```

Keep everything after (the `if (successCount > 0)` toast/close logic) unchanged.

- [ ] **Step 5: Reset org state on cancel**

In `handleCancel` (line ~590), add resets so a reopened modal starts clean:

```typescript
  const handleCancel = useCallback(() => {
    if (!submitting) {
      setError(null);
      setInstallNeeded(null);
      setStagedRepos([]);
      setOrgInput('');
      setOrgQuery(null);
      setShowForksArchived(false);
      autoStagedOrgRef.current = null;
      onOpenChange(false);
    }
  }, [submitting, onOpenChange]);
```

- [ ] **Step 6: Typecheck and lint the modified file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep AddRepositoryModal`
Expected: no output.
Run: `npx eslint src/components/features/workspace/AddRepositoryModal.tsx`
Expected: no errors (fix any that appear — e.g. exhaustive-deps on the new effect; if the linter demands `stagedRepos` in the auto-stage effect deps, keep the functional `setStagedRepos((prev) => ...)` form and add the dep or a targeted disable comment explaining the once-per-org guard).

- [ ] **Step 7: Commit**

```bash
git add src/components/features/workspace/AddRepositoryModal.tsx
git commit -m "feat: add Import from org tab to workspace Add Repository modal"
```

---

### Task 6: Full verification

**Files:** none new.

- [ ] **Step 1: Run the new and adjacent test files**

Run: `npx vitest run src/lib/utils/org-import.test.ts src/lib/utils/concurrency.test.ts src/services/__tests__/workspace-bulk-add.test.ts src/services/__tests__/workspace.service.test.ts`
Expected: all PASS.

- [ ] **Step 2: Production build (includes typecheck)**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Manual verification (requires a signed-in session)**

Start the dev server (`npm run dev`), then:
1. Open a workspace → Add Repository → "Import from org" tab.
2. Enter `papercomputeco` → Load repos. Expect: repo list sorted by recent push; eligible repos auto-staged into the cart up to the remaining slots; toast confirming the selection.
3. Toggle "Show forks & archived" and confirm the list expands.
4. If the org has private repos and no GitHub App installation, confirm they are greyed out and the install alert renders.
5. Submit. Expect: one success toast, repos appear in the workspace, and repos that fail tracking are reported individually while the rest are added.
6. Reopen the modal and confirm imported repos now show "added" in the org list.

- [ ] **Step 4: Update plan checkboxes and finish**

Mark all checkboxes done in this file, then use the superpowers:finishing-a-development-branch skill (or open a PR) per the user's preference.
