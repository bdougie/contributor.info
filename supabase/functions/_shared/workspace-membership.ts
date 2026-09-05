import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Resolve whether an authenticated user is an accepted member (or the owner)
 * of a workspace.
 *
 * `workspace_members.user_id` and `workspaces.owner_id` store `app_users.id`,
 * not `auth.users.id`; the database's `rls_current_app_user_id()` helper makes
 * the same translation for RLS. Both ids are accepted here so older rows that
 * stored the auth id keep working.
 */
export async function isWorkspaceMember(
  admin: SupabaseClient,
  workspaceId: string,
  authUserId: string,
): Promise<{ member: boolean; error?: string }> {
  const { data: appUser, error: appUserError } = await admin
    .from('app_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (appUserError) {
    return {
      member: false,
      error: `Could not resolve the application user: ${appUserError.message}`,
    };
  }

  const candidateIds = appUser?.id ? [authUserId, String(appUser.id)] : [authUserId];

  const { data: membership, error: membershipError } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('user_id', candidateIds)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle();
  if (membershipError) {
    return {
      member: false,
      error: `Could not verify workspace membership: ${membershipError.message}`,
    };
  }
  if (membership) return { member: true };

  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .in('owner_id', candidateIds)
    .maybeSingle();
  if (workspaceError) {
    return {
      member: false,
      error: `Could not verify workspace ownership: ${workspaceError.message}`,
    };
  }
  return { member: Boolean(workspace) };
}
