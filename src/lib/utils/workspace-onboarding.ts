import { z } from 'zod';
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

const draftSchema = z.object({
  name: z.string().max(50),
  description: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']),
});

function draftKey(repository: string | null): string {
  return `workspace-create-draft:${repository?.toLowerCase() || 'new'}`;
}

export function readWorkspaceDraft(repository: string | null): Partial<CreateWorkspaceRequest> {
  try {
    const result = draftSchema.safeParse(
      JSON.parse(sessionStorage.getItem(draftKey(repository)) || 'null')
    );
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function saveWorkspaceDraft(
  repository: string | null,
  draft: CreateWorkspaceRequest
): boolean {
  try {
    sessionStorage.setItem(draftKey(repository), JSON.stringify(draftSchema.parse(draft)));
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
