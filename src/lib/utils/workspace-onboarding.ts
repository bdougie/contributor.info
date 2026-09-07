import type { CreateWorkspaceRequest } from '@/types/workspace';

/** Accept exact repository names and GitHub repository URLs, not arbitrary URLs. */
export function parseRepositoryInput(input: string | null): string | null {
  let name = input?.trim() || '';
  if (/^https?:\/\//i.test(name)) {
    try {
      const url = new URL(name);
      if (url.hostname !== 'github.com' || url.username || url.password || url.port) return null;
      name = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch {
      return null;
    }
  }
  name = name.replace(/\.git$/, '');
  return /^[a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+$/i.test(name) &&
    !['.', '..'].includes(name.split('/')[1])
    ? name
    : null;
}

export function getWorkspaceCreationRoute(repository?: string): string {
  const name = parseRepositoryInput(repository || null);
  return name ? `/workspaces/new?${new URLSearchParams({ repository: name })}` : '/workspaces/new';
}

// Hand-written instead of a zod schema: this module is imported by the
// workspace page, and zod is ~30KB gzipped that the dashboard does not need.
const DRAFT_NAME_MAX = 50;
const DRAFT_DESCRIPTION_MAX = 500;
const DRAFT_VISIBILITIES = ['public', 'private'] as const;

type DraftVisibility = (typeof DRAFT_VISIBILITIES)[number];

interface WorkspaceDraft {
  name: string;
  description?: string;
  visibility: DraftVisibility;
}

function isDraftVisibility(value: string): value is DraftVisibility {
  return (DRAFT_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Validate an untrusted value against the draft shape. Returns a fresh object
 * containing only the known keys (unknown keys are dropped, like a strict
 * schema parse), or null when any field is missing or out of range.
 */
function parseDraft(value: unknown): WorkspaceDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { name, description, visibility } = record;
  if (typeof name !== 'string' || name.length > DRAFT_NAME_MAX) return null;
  if (typeof visibility !== 'string' || !isDraftVisibility(visibility)) return null;
  if (description !== undefined) {
    if (typeof description !== 'string' || description.length > DRAFT_DESCRIPTION_MAX) return null;
  }
  const draft: WorkspaceDraft = { name, visibility };
  if (description !== undefined) draft.description = description;
  return draft;
}

function draftKey(repository: string | null): string {
  return `workspace-create-draft:${repository?.toLowerCase() || 'new'}`;
}

export function readWorkspaceDraft(repository: string | null): Partial<CreateWorkspaceRequest> {
  try {
    const draft = parseDraft(JSON.parse(sessionStorage.getItem(draftKey(repository)) || 'null'));
    return draft ?? {};
  } catch {
    return {};
  }
}

export function saveWorkspaceDraft(
  repository: string | null,
  draft: CreateWorkspaceRequest
): boolean {
  try {
    const parsed = parseDraft(draft);
    if (!parsed) return false;
    sessionStorage.setItem(draftKey(repository), JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkspaceDraft(repository: string | null): void {
  try {
    sessionStorage.removeItem(draftKey(repository));
  } catch {
    // Storage may be disabled by the browser; creation should still work.
  }
}
