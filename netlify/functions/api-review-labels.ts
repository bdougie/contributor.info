import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiter, getRateLimitKey } from './lib/rate-limiter.mts';
import { captureNextPR, github, type GitHubPerson } from './lib/review-label-github';
import type {
  LabelRecord,
  ReviewCampaign,
  ReviewEnrollment,
  ReviewHome,
  ReviewPR,
  ReviewQueue,
  ReviewWorkspace,
} from '../../src/types/review-labels';

const uuid = z.string().uuid();
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), token: tokenSchema }),
  z.object({ action: z.literal('view'), token: tokenSchema, visitId: uuid }),
  z.object({ action: z.literal('accept'), token: tokenSchema }),
  z.object({ action: z.literal('home') }),
  z.object({
    action: z.literal('campaign'),
    workspaceId: uuid,
    repositoryIds: z.array(uuid).min(1).max(5),
  }),
  z.object({
    action: z.literal('invite'),
    campaignId: uuid,
    login: z.string().regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i),
  }),
  z.object({ action: z.literal('revoke'), inviteId: uuid }),
  z.object({ action: z.literal('queue'), enrollmentId: uuid }),
  z.object({ action: z.literal('scan'), enrollmentId: uuid }),
  z.object({
    action: z.literal('label'),
    prId: uuid,
    target: z.string().min(1).max(1000),
    label: z.enum(['good', 'bad', 'skip', 'missed']),
    note: z
      .string()
      .min(1)
      .max(280)
      .regex(/^[^\r\n]+$/)
      .optional(),
    consentVersion: z.string().optional(),
  }),
  z.object({ action: z.literal('export'), enrollmentId: uuid }),
  z.object({ action: z.literal('withdraw'), enrollmentId: uuid }),
]);
interface Enrollment extends ReviewEnrollment {
  user_id: string;
  reviewer_github_id: string;
}
interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  is_active: boolean;
  tier: string;
}
interface InviteRow {
  id: string;
  campaign_id: string;
  reviewer_login: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}
interface Snapshot {
  id: string;
  enrollment_id: string;
  payload: ReviewPR;
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error)
    throw new HttpError(500, 'Review labels could not be saved or loaded. Please try again.');
  return result.data;
}
function reply(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

// Dependency injection keeps request authorization testable without bypass flags.
export function createReviewLabelsHandler(db: SupabaseClient) {
  async function identity(user: User): Promise<{ appId: string; githubId: string }> {
    const githubIdentity = user.identities?.find((i) => i.provider === 'github');
    if (!githubIdentity || !/^\d+$/.test(githubIdentity.id))
      throw new HttpError(403, 'Sign in with GitHub to label reviews');
    const app = checked(
      await db.from('app_users').select('id').eq('auth_user_id', user.id).maybeSingle()
    );
    if (!app) throw new HttpError(403, 'Finish creating your account, then try again');
    return { appId: app.id as string, githubId: githubIdentity.id };
  }
  async function workspaceAccess(
    workspaceId: string,
    user: User,
    manage = false
  ): Promise<Workspace> {
    const actor = await identity(user);
    const workspace = checked(
      await db
        .from('workspaces')
        .select('id,name,owner_id,is_active,tier')
        .eq('id', workspaceId)
        .maybeSingle()
    ) as Workspace | null;
    if (!workspace?.is_active) throw new HttpError(404, 'Workspace unavailable');
    if (workspace.owner_id === actor.appId) return workspace;
    const member = checked(
      await db
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', actor.appId)
        .not('accepted_at', 'is', null)
        .maybeSingle()
    );
    if (!member || (manage && !['owner', 'admin'].includes(member.role)))
      throw new HttpError(403, 'Workspace permission required');
    return workspace;
  }
  async function campaignAccess(
    campaignId: string,
    user: User,
    manage = false
  ): Promise<ReviewCampaign> {
    const campaign = checked(
      await db.from('review_label_campaigns').select('*').eq('id', campaignId).maybeSingle()
    ) as ReviewCampaign | null;
    if (!campaign) throw new HttpError(404, 'Review collection unavailable');
    await workspaceAccess(campaign.workspace_id, user, manage);
    return campaign;
  }
  async function enrollmentAccess(enrollmentId: string, user: User): Promise<Enrollment> {
    const enrollment = checked(
      await db
        .from('review_label_enrollments')
        .select('*')
        .eq('id', enrollmentId)
        .eq('user_id', user.id)
        .maybeSingle()
    ) as Enrollment | null;
    if (!enrollment) throw new HttpError(403, 'This review queue belongs to another account');
    const actor = await identity(user);
    if (actor.githubId !== enrollment.reviewer_github_id)
      throw new HttpError(403, 'Sign in with the enrolled GitHub account');
    const campaign = await campaignAccess(enrollment.campaign_id, user);
    // Removing a selected repo or making it private immediately closes access,
    // including exports of already captured public data.
    const repos = await selectedRepositories(campaign.workspace_id, campaign.repository_ids);
    if (repos.length !== campaign.repository_ids.length)
      throw new HttpError(403, 'Selected repository access has changed');
    for (const repo of repos) {
      const visibility = await github<{ private: boolean }>(`/repos/${repo.full_name}`);
      if (visibility.private)
        throw new HttpError(403, 'This repository is now private. Review access is paused.');
    }
    return enrollment;
  }
  async function selectedRepositories(workspaceId: string, ids?: string[]) {
    const links = checked(
      await db
        .from('workspace_repositories')
        .select('repository_id')
        .eq('workspace_id', workspaceId)
    );
    const available = (links || []).map((row) => row.repository_id as string);
    if (ids?.some((id) => !available.includes(id)))
      throw new HttpError(403, 'Select repositories from this workspace');
    if (!available.length) return [];
    const repos = checked(
      await db
        .from('repositories')
        .select('id,full_name,is_private')
        .in('id', ids || available)
    ) as ReviewWorkspace['repositories'];
    return repos.filter(
      (repo) =>
        repo.is_private === false &&
        /^papercomputeco\/(tapes|tapesctl|paper|paper-forest|cloud)$/.test(repo.full_name)
    );
  }
  async function allRows<T>(
    table: string,
    columns: string,
    key: string,
    value: string
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const data = checked(
        await db
          .from(table)
          .select(columns)
          .eq(key, value)
          .order('id')
          .range(offset, offset + 499)
      ) as T[];
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  async function queue(enrollmentId: string, user: User): Promise<ReviewQueue> {
    const enrollment = await enrollmentAccess(enrollmentId, user);
    const [prs, labels] = await Promise.all([
      allRows<{ id: string; payload: ReviewPR }>(
        'review_label_prs',
        'id,payload',
        'enrollment_id',
        enrollmentId
      ),
      allRows<{ record: LabelRecord }>('review_labels', 'id,record', 'enrollment_id', enrollmentId),
    ]);
    return {
      enrollment,
      prs: prs
        .map((pr) => ({ ...pr.payload, id: pr.id }))
        .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
      labels: labels.map((label) => label.record),
    };
  }
  return async function handle(req: Request): Promise<Response> {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
      // Browser writes must originate from this application. No credential cookies
      // are accepted: authenticated actions require a verified bearer token.
      const origin = req.headers.get('origin');
      const local =
        new URL(req.url).hostname === 'localhost' &&
        origin &&
        new URL(origin).hostname === 'localhost';
      if (origin && !local && new URL(origin).host !== new URL(req.url).host)
        throw new HttpError(403, 'Invalid request origin');
      const raw = await req.text();
      if (raw.length > 8192) throw new HttpError(413, 'Request too large');
      const parsed = requestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new HttpError(400, 'Invalid review-label request');
      const input = parsed.data;
      if (input.action === 'preview' || input.action === 'view') {
        const invite = checked(
          await db
            .from('review_label_invites')
            .select('id,campaign_id,reviewer_login,expires_at,accepted_at,revoked_at')
            .eq('token_hash', hash(input.token))
            .maybeSingle()
        ) as InviteRow | null;
        if (
          !invite ||
          invite.revoked_at ||
          (!invite.accepted_at && Date.parse(invite.expires_at) <= Date.now())
        )
          throw new HttpError(
            410,
            'This invitation has expired or is unavailable. Ask the sender for a new link.'
          );
        if (input.action === 'view') {
          checked(
            await db.rpc('record_review_invite_view', {
              p_hash: hash(input.token),
              p_visit: input.visitId,
            })
          );
          return reply({ ok: true });
        }
        const campaign = checked(
          await db
            .from('review_label_campaigns')
            .select('workspace_id')
            .eq('id', invite.campaign_id)
            .maybeSingle()
        );
        if (!campaign) throw new HttpError(410, 'Invitation unavailable');
        const workspace = checked(
          await db
            .from('workspaces')
            .select('name')
            .eq('id', campaign.workspace_id)
            .eq('is_active', true)
            .maybeSingle()
        );
        if (!workspace) throw new HttpError(410, 'Workspace unavailable');
        return reply({
          workspaceName: workspace.name,
          reviewerLogin: invite.reviewer_login,
          expiresAt: invite.expires_at,
          accepted: !!invite.accepted_at,
        });
      }
      const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!bearer) throw new HttpError(401, 'Sign in with GitHub to continue');
      const auth = await db.auth.getUser(bearer);
      if (auth.error || !auth.data.user)
        throw new HttpError(401, 'Your session expired. Sign in again.');
      const user = auth.data.user;
      if (input.action === 'accept') {
        const result = await db.rpc('accept_review_label_invite', {
          p_hash: hash(input.token),
          p_user: user.id,
        });
        if (result.error) throw new HttpError(403, result.error.message);
        return reply({ enrollmentId: result.data });
      }
      if (input.action === 'home') {
        const actor = await identity(user);
        const [owned, members, enrollments] = await Promise.all([
          db.from('workspaces').select('id').eq('owner_id', actor.appId).eq('is_active', true),
          db
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', actor.appId)
            .not('accepted_at', 'is', null),
          db
            .from('review_label_enrollments')
            .select('id,campaign_id,reviewer_login,consent_at,scan_repo,scan_page,scan_done')
            .eq('user_id', user.id),
        ]);
        const ids = [
          ...new Set([
            ...(checked(owned) || []).map((w) => w.id as string),
            ...(checked(members) || []).map((m) => m.workspace_id as string),
          ]),
        ];
        const workspaces: ReviewWorkspace[] = [];
        for (const id of ids) {
          let workspace: Workspace;
          try {
            workspace = await workspaceAccess(id, user);
          } catch (error) {
            if (error instanceof HttpError && error.status === 404) continue;
            throw error;
          }
          const member = checked(
            await db
              .from('workspace_members')
              .select('role')
              .eq('workspace_id', id)
              .eq('user_id', actor.appId)
              .maybeSingle()
          );
          const canManage =
            workspace.owner_id === actor.appId || ['owner', 'admin'].includes(member?.role);
          const campaigns = checked(
            await db
              .from('review_label_campaigns')
              .select('id,workspace_id,repository_ids,cutoff')
              .eq('workspace_id', id)
              .order('created_at', { ascending: false })
          ) as ReviewCampaign[];
          const invites =
            canManage && campaigns.length
              ? checked(
                  await db
                    .from('review_label_invites')
                    .select(
                      'id,campaign_id,reviewer_login,created_at,expires_at,first_viewed_at,last_viewed_at,view_count,accepted_at,revoked_at'
                    )
                    .in(
                      'campaign_id',
                      campaigns.map((c) => c.id)
                    )
                    .order('created_at', { ascending: false })
                )
              : [];
          workspaces.push({
            id,
            name: workspace.name,
            canManage,
            repositories: await selectedRepositories(id),
            campaigns,
            invites: invites || [],
          });
        }
        return reply({
          workspaces,
          enrollments: checked(enrollments) || [],
        } satisfies ReviewHome);
      }
      if (input.action === 'campaign') {
        await workspaceAccess(input.workspaceId, user, true);
        const ids = [...new Set(input.repositoryIds)];
        const repos = await selectedRepositories(input.workspaceId, ids);
        if (repos.length !== ids.length)
          throw new HttpError(400, 'Choose public Paper Compute repositories');
        // Check actual GitHub visibility, not only cached metadata.
        for (const repo of repos)
          if ((await github<{ private: boolean }>(`/repos/${repo.full_name}`)).private)
            throw new HttpError(400, 'Private repository support is not enabled');
        const created = checked(
          await db
            .from('review_label_campaigns')
            .insert({ workspace_id: input.workspaceId, repository_ids: ids, created_by: user.id })
            .select()
            .maybeSingle()
        );
        if (!created) throw new HttpError(500, 'Review collection could not be created');
        return reply(created);
      }
      if (input.action === 'invite') {
        const campaign = await campaignAccess(input.campaignId, user, true);
        await selectedRepositories(campaign.workspace_id, campaign.repository_ids);
        const person = await github<GitHubPerson>(`/users/${encodeURIComponent(input.login)}`);
        if (person.type !== 'User') throw new HttpError(400, 'Invite a person’s GitHub account');
        const token = randomBytes(32).toString('hex');
        const invite = checked(
          await db
            .from('review_label_invites')
            .insert({
              campaign_id: campaign.id,
              reviewer_github_id: String(person.id),
              reviewer_login: person.login,
              token_hash: hash(token),
              created_by: user.id,
            })
            .select('id')
            .maybeSingle()
        );
        if (!invite) throw new HttpError(500, 'Invitation could not be created');
        return reply({ id: invite.id, token });
      }
      if (input.action === 'revoke') {
        const invite = checked(
          await db
            .from('review_label_invites')
            .select('campaign_id')
            .eq('id', input.inviteId)
            .maybeSingle()
        );
        if (!invite) throw new HttpError(404, 'Invitation unavailable');
        await campaignAccess(invite.campaign_id, user, true);
        checked(
          await db
            .from('review_label_invites')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', input.inviteId)
            .is('accepted_at', null)
        );
        return reply({ ok: true });
      }
      if (input.action === 'queue') return reply(await queue(input.enrollmentId, user));
      if (input.action === 'scan') {
        const enrollment = await enrollmentAccess(input.enrollmentId, user);
        if (enrollment.scan_done) return reply({ done: true });
        const campaign = await campaignAccess(enrollment.campaign_id, user);
        const repositoryId = campaign.repository_ids[enrollment.scan_repo];
        if (!repositoryId) throw new HttpError(409, 'Review history cursor is invalid');
        const repos = await selectedRepositories(campaign.workspace_id, [repositoryId]);
        const repo = repos[0];
        if (!repo) throw new HttpError(403, 'Repository unavailable');
        const next = await captureNextPR(
          repo.full_name,
          enrollment.scan_page,
          campaign.cutoff,
          enrollment.reviewer_github_id
        );
        // Repeat capture is safe; never overwrite a snapshot already labeled.
        if (next.pr)
          checked(
            await db.from('review_label_prs').upsert(
              {
                id: randomUUID(),
                enrollment_id: enrollment.id,
                repository_id: repo.id,
                pr_number: next.pr.number,
                payload: next.pr,
              },
              { onConflict: 'enrollment_id,repository_id,pr_number', ignoreDuplicates: true }
            )
          );
        const scanRepo = next.finished ? enrollment.scan_repo + 1 : enrollment.scan_repo;
        const done = scanRepo >= campaign.repository_ids.length;
        checked(
          await db
            .from('review_label_enrollments')
            .update({
              scan_repo: scanRepo,
              scan_page: next.finished ? 1 : enrollment.scan_page + 1,
              scan_done: done,
            })
            .eq('id', enrollment.id)
            .eq('scan_repo', enrollment.scan_repo)
            .eq('scan_page', enrollment.scan_page)
        );
        return reply({ done, added: !!next.pr });
      }
      if (input.action === 'label') {
        const pr = checked(
          await db
            .from('review_label_prs')
            .select('id,enrollment_id')
            .eq('id', input.prId)
            .maybeSingle()
        ) as Snapshot | null;
        if (!pr) throw new HttpError(404, 'Review unavailable');
        await enrollmentAccess(pr.enrollment_id, user);
        const result = await db.rpc('save_review_label', {
          p_user: user.id,
          p_pr: input.prId,
          p_target: input.target,
          p_label: input.label,
          p_note: input.note ?? null,
          p_consent_version: input.consentVersion ?? null,
        });
        if (result.error) throw new HttpError(400, result.error.message);
        return reply(result.data);
      }
      if (input.action === 'withdraw') {
        // Withdrawal remains available after workspace membership is removed.
        checked(
          await db.rpc('withdraw_review_label_consent', {
            p_user: user.id,
            p_enrollment: input.enrollmentId,
          })
        );
        const enrollment = checked(
          await db
            .from('review_label_enrollments')
            .select('campaign_id')
            .eq('id', input.enrollmentId)
            .eq('user_id', user.id)
            .maybeSingle()
        );
        if (!enrollment) throw new HttpError(404, 'Enrollment unavailable');
        const revocations = checked(
          await db
            .from('review_label_consent_revocations')
            .select('consent_id,campaign_id,revoked_at')
            .eq('user_id', user.id)
            .eq('campaign_id', enrollment.campaign_id)
        );
        return reply({ ok: true, revocations });
      }
      const data = await queue(input.enrollmentId, user);
      const revocations = checked(
        await db
          .from('review_label_consent_revocations')
          .select('consent_id,campaign_id,revoked_at')
          .eq('user_id', user.id)
          .eq('campaign_id', data.enrollment.campaign_id)
      );
      return reply({ labels: data.labels, revocations });
    } catch (error) {
      if (error instanceof HttpError) return reply({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return reply({ error: 'Invalid request body' }, 400);
      return reply(
        {
          error:
            error instanceof Error ? error.message : 'Review labels are temporarily unavailable',
        },
        503
      );
    }
  };
}

let handler: ReturnType<typeof createReviewLabelsHandler> | null = null;
let limiter: RateLimiter | null = null;
export default async (req: Request): Promise<Response> => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply({ error: 'Review labels are not configured on this server' }, 503);
  handler ??= createReviewLabelsHandler(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  );
  limiter ??= new RateLimiter(url, key, {
    maxRequests: 120,
    windowMs: 60000,
    keyPrefix: 'review-labels',
  });
  const limit = await limiter.checkLimit(getRateLimitKey(req));
  if (!limit.allowed)
    return reply({ error: 'Too many requests. Please wait a minute and retry.' }, 429);
  return handler(req);
};
