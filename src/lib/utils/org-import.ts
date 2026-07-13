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
