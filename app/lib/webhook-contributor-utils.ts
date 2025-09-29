// Shared webhook contributor utility (Phase 2)
// After Phase 2, webhook handlers should import from here instead of inline helpers.

import { createSupabaseAdmin } from '../../netlify/functions/src/lib/supabase-admin';

interface GithubUserLike {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  email?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  public_repos?: number;
  followers?: number;
  following?: number;
  created_at?: string;
  type?: string;
}

export async function ensureContributorForWebhook(
  githubUser: GithubUserLike | undefined | null
): Promise<string | null> {
  if (!githubUser || !githubUser.id || !githubUser.login) return null;

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const now = new Date().toISOString();
    
    // Check if contributor already exists to preserve first_seen_at
    const { data: existing } = await supabaseAdmin
      .from('contributors')
      .select('id, first_seen_at')
      .eq('github_id', githubUser.id)
      .maybeSingle();

    const contributorData = {
      github_id: githubUser.id,
      username: githubUser.login,
      display_name: githubUser.name || githubUser.login,
      email: githubUser.email || null,
      avatar_url: githubUser.avatar_url || null,
      profile_url: githubUser.html_url || `https://github.com/${githubUser.login}`,
      bio: githubUser.bio || null,
      company: githubUser.company || null,
      location: githubUser.location || null,
      blog: githubUser.blog || null,
      public_repos: githubUser.public_repos || 0,
      followers: githubUser.followers || 0,
      following: githubUser.following || 0,
      github_created_at: githubUser.created_at || now,
      is_bot: githubUser.type === 'Bot' || githubUser.login.includes('[bot]'),
      is_active: true,
      // Preserve existing first_seen_at or set for new contributors
      first_seen_at: existing?.first_seen_at || now,
      last_updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('contributors')
      .upsert(contributorData, { onConflict: 'github_id' })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('ensureContributorForWebhook error:', error.message);
      return null;
    }
    return data?.id || null;
  } catch (e: any) {
    console.error('ensureContributorForWebhook unexpected error:', e?.message || e);
    return null;
  }
}
