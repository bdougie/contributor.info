/**
 * Build the workspace page's initial state from the edge-rendered payload.
 *
 * The edge function (netlify/edge-functions/ssr-workspace-detail.ts) inlines the
 * full workspace row and repository list as `window.__SSR_DATA__`. Reading it in
 * `useState` initializers lets hydration render the dashboard on the first frame
 * instead of a skeleton that replaces the server HTML.
 */
import type { WorkspaceDetailPageData } from '@/lib/ssr-hydration';
import type { Repository } from '@/components/features/workspace/RepositoryList';
import type { Workspace } from '@/types/workspace';
import { getFallbackAvatar } from '@/lib/utils/avatar';

export interface WorkspaceSSRSeed {
  workspace: Workspace;
  repositories: Repository[];
  memberCount: number;
}

/**
 * Build initial page state from the edge-rendered payload so hydration renders
 * the dashboard on the first frame instead of a skeleton. Returns null when the
 * payload is missing or describes a different workspace than the URL.
 */
export function seedFromSSR(
  ssrData: WorkspaceDetailPageData | null,
  requestedId: string | undefined
): WorkspaceSSRSeed | null {
  const ws = ssrData?.workspace;
  if (!ws || !requestedId) return null;

  const requested = requestedId.toLowerCase();
  if (ws.slug.toLowerCase() !== requested && ws.id.toLowerCase() !== requested) return null;

  const workspace: Workspace = {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    owner_id: ws.owner_id,
    visibility: ws.visibility,
    tier: ws.tier as Workspace['tier'],
    max_repositories: ws.max_repositories,
    current_repository_count: ws.current_repository_count,
    data_retention_days: ws.data_retention_days,
    settings: ws.settings as Workspace['settings'],
    created_at: ws.created_at,
    updated_at: ws.updated_at,
    last_activity_at: ws.last_activity_at,
    is_active: ws.is_active,
  };

  const repositories: Repository[] = ws.repositories.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    owner: r.owner,
    description: r.description ?? undefined,
    language: r.language ?? undefined,
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    open_prs: 0,
    open_issues: r.open_issues_count || 0,
    contributors: 0,
    last_activity: new Date().toISOString(),
    is_pinned: r.is_pinned,
    avatar_url:
      r.avatar_url ||
      (r.owner ? `https://avatars.githubusercontent.com/${r.owner}` : getFallbackAvatar()),
    html_url: `https://github.com/${r.full_name}`,
  }));

  return { workspace, repositories, memberCount: ws.member_count };
}
