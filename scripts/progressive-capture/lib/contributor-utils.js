// Shared contributor utility functions (Phase 2)
// Ensures we always work with internal contributor UUIDs instead of raw GitHub IDs.

export async function ensureContributor(supabase, githubUser) {
  if (!githubUser || !githubUser.id || !githubUser.login) return null;

  try {
    const { data: contributor, error } = await supabase
      .from('contributors')
      .upsert(
        {
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
          github_created_at: githubUser.created_at || new Date().toISOString(),
          is_bot: githubUser.type === 'Bot' || (githubUser.login || '').includes('[bot]'),
          is_active: true,
          first_seen_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('ensureContributor upsert error:', error.message);
      return null;
    }
    return contributor?.id || null;
  } catch (e) {
    console.error('ensureContributor unexpected error:', e);
    return null;
  }
}

export async function ensureMergedByContributor(supabase, mergedBy) {
  if (!mergedBy) return null;
  return ensureContributor(supabase, mergedBy);
}
