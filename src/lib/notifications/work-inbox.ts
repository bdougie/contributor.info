import { getSupabase } from '@/lib/supabase-lazy';
import type { GitHubWorkItem } from '@/lib/workspace/github-my-work';

export type WorkInboxCategory = 'awaiting_reply' | 'review_requested';
export interface WorkInboxScope {
  observed_at: string;
  workspace_count: number;
  repositories: { id: string; full_name: string }[];
}
export interface WorkSnapshotItem {
  subject_key: string;
  source_version: string;
  title: string;
  url: string;
  actor: string;
  preview: string;
  occurred_at: string;
}
export interface WorkInboxItem extends WorkSnapshotItem {
  id: string;
  repository_id: string;
  category: WorkInboxCategory;
  is_read: boolean;
  revision: number;
  repository: { full_name: string };
}

export function toWorkSnapshot(
  items: GitHubWorkItem[],
  category: WorkInboxCategory
): WorkSnapshotItem[] {
  const unique = new Map<string, WorkSnapshotItem>();
  for (const item of items) {
    if (category === 'review_requested') {
      // General PR updates are not new review requests. Absence/reappearance rearms this item.
      const key = `review:${item.nodeId || item.id}`;
      unique.set(key, {
        subject_key: key,
        source_version: 'requested',
        title: item.title,
        url: item.url,
        actor: item.author,
        preview: '',
        occurred_at: item.updatedAt,
      });
    } else {
      for (const reply of item.replies || []) {
        const key =
          reply.kind === 'conversation'
            ? `conversation:${item.nodeId || item.id}`
            : `thread:${reply.threadId || reply.url.split('#')[1]}`;
        unique.set(key, {
          subject_key: key,
          source_version: reply.url,
          title: item.title,
          url: reply.url,
          actor: reply.author,
          preview: reply.body,
          occurred_at: reply.createdAt,
        });
      }
    }
  }
  return [...unique.values()];
}

export class WorkInboxUnavailableError extends Error {
  constructor() {
    super('Workspace notifications are not available yet.');
    this.name = 'WorkInboxUnavailableError';
  }
}

export function inboxError(error: { message: string; code?: string }): Error {
  if (error.code === 'PGRST202' || error.code === '42P01') {
    return new WorkInboxUnavailableError();
  }
  return new Error(error.message);
}

export async function beginWorkScan(): Promise<WorkInboxScope> {
  const db = await getSupabase();
  const { data, error } = await db.rpc('begin_workspace_work_scan');
  if (error) throw inboxError(error);
  if (!data || !Array.isArray(data.repositories) || typeof data.workspace_count !== 'number') {
    throw new Error('Could not confirm workspace notification access.');
  }
  return data;
}

export async function getWorkInbox() {
  const db = await getSupabase();
  const { data, error } = await db
    .from('workspace_work_inbox')
    .select(
      'id,repository_id,category,subject_key,source_version,revision,title,url,actor,preview,occurred_at,is_read,repository:repositories!inner(full_name)'
    )
    .eq('is_pending', true)
    .order('is_read')
    .order('occurred_at', { ascending: false })
    .limit(30)
    .returns<WorkInboxItem[]>();
  if (error) throw inboxError(error);
  const { count, error: countError } = await db
    .from('workspace_work_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('is_pending', true)
    .eq('is_read', false);
  if (countError) throw inboxError(countError);
  return { items: data || [], unreadCount: count || 0 };
}

export async function markWorkRead(item: WorkInboxItem) {
  const db = await getSupabase();
  const { error } = await db.rpc('read_workspace_work', {
    p_id: item.id,
    p_revision: item.revision,
  });
  if (error) throw inboxError(error);
}
