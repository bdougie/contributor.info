/**
 * `discover/repository.new`: unknown repository → repositories row →
 * tracked_repositories row → classification + initial capture.
 * Ported from src/lib/inngest/functions/discover-new-repository.ts.
 * `capture/repository.discover` (the inngest-prod spelling) maps here too.
 */

import { fetchGitHubAPI, GITHUB_API_BASE } from '../github.ts';
import { assertRepositoryName, asString, NonRetriableJobError } from './types.ts';
import type { JobContext, JobPayload, JobResult } from './types.ts';

interface GitHubRepository {
  id: number;
  full_name: string;
  owner: { login: string };
  name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: { spdx_id: string | null } | null;
  topics: string[];
  default_branch: string;
}

export async function discoverRepository(ctx: JobContext, payload: JobPayload): Promise<JobResult> {
  const [owner, repo] = assertRepositoryName(
    payload.owner,
    asString(payload.repo) ?? asString(payload.name),
  );
  const fullName = `${owner}/${repo}`;
  const { supabase } = ctx;

  const { data: existing } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();

  if (existing?.id) {
    await ctx.enqueue('capture/repository.sync.graphql', {
      repositoryId: existing.id,
      repositoryName: fullName,
      days: 30,
      priority: 'high',
      reason: 'User discovery of existing repo',
    }, { repositoryId: existing.id });
    return { status: 'existing', repositoryId: existing.id, repository: fullName };
  }

  if (!ctx.githubToken) throw new NonRetriableJobError('GitHub token not configured');
  let github: GitHubRepository;
  try {
    github = await fetchGitHubAPI<GitHubRepository>(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      ctx.githubToken,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(' 404 ')) {
      throw new NonRetriableJobError(`Repository ${fullName} not found on GitHub`);
    }
    throw error;
  }

  const now = new Date().toISOString();
  const { data: created, error: insertError } = await supabase
    .from('repositories')
    .insert({
      github_id: github.id,
      full_name: github.full_name,
      owner: github.owner.login,
      name: github.name,
      description: github.description,
      homepage: github.homepage,
      language: github.language,
      stargazers_count: github.stargazers_count,
      watchers_count: github.watchers_count,
      forks_count: github.forks_count,
      open_issues_count: github.open_issues_count,
      size: github.size,
      default_branch: github.default_branch,
      is_fork: github.fork,
      is_archived: github.archived,
      is_disabled: github.disabled,
      is_private: github.private,
      has_issues: github.has_issues,
      has_projects: github.has_projects,
      has_wiki: github.has_wiki,
      has_pages: github.has_pages,
      has_downloads: github.has_downloads,
      has_discussions: github.has_discussions,
      license: github.license?.spdx_id ?? null,
      topics: github.topics ?? [],
      github_created_at: github.created_at,
      github_updated_at: github.updated_at,
      github_pushed_at: github.pushed_at,
      first_tracked_at: now,
      last_updated_at: now,
      is_active: true,
    })
    .select('id')
    .maybeSingle();

  let repositoryId = created?.id as string | undefined;
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced } = await supabase.from('repositories').select('id').eq(
        'github_id',
        github.id,
      ).maybeSingle();
      repositoryId = raced?.id;
    }
    if (!repositoryId) throw new Error(`Failed to create repository: ${insertError.message}`);
  }
  if (!repositoryId) throw new Error('Repository insert returned no id');

  const { error: trackError } = await supabase.from('tracked_repositories').insert({
    repository_id: repositoryId,
    organization_name: owner,
    repository_name: repo,
    tracking_enabled: true,
    priority: 'high',
    created_at: now,
    updated_at: now,
  });
  if (trackError && trackError.code !== '23505') {
    console.error(
      '[discover] tracked_repositories insert failed for %s: %s',
      fullName,
      trackError.message,
    );
  }

  await ctx.enqueue('classify/repository.single', { repositoryId, owner, repo }, { repositoryId });
  await ctx.enqueue('capture/repository.sync.graphql', {
    repositoryId,
    repositoryName: fullName,
    days: 30,
    priority: 'high',
    reason: 'Initial repository discovery',
  }, { repositoryId });

  return {
    status: 'discovered',
    repositoryId,
    repository: fullName,
    stars: github.stargazers_count,
    language: github.language,
  };
}
