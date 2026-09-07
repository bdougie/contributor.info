import { getSupabase } from '@/lib/supabase-lazy';
import type {
  LabelRecord,
  ReviewCampaign,
  ReviewHome,
  ReviewInvitePreview,
  ReviewQueue,
  ReviewDecision,
} from '@/types/review-labels';
import { REVIEW_CONSENT_VERSION } from '@/types/review-labels';

export class ReviewLabelsUnavailableError extends Error {
  constructor() {
    super('The review-label service is unavailable. Please try again.');
  }
}

async function request<T>(body: object): Promise<T> {
  const supabase = await getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch('/.netlify/functions/api-review-labels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ReviewLabelsUnavailableError();
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Review labels could not be loaded');
  return result as T;
}
const visitKey = 'review-labels-invite-visit';
let fallbackVisit: string | undefined;
export function inviteVisitId(): string {
  try {
    const previous = sessionStorage.getItem(visitKey);
    if (previous) return previous;
    const id = crypto.randomUUID();
    sessionStorage.setItem(visitKey, id);
    return id;
  } catch {
    return (fallbackVisit ??= crypto.randomUUID());
  }
}

export const ReviewLabelsService = {
  home: () => request<ReviewHome>({ action: 'home' }),
  preview: (token: string) => request<ReviewInvitePreview>({ action: 'preview', token }),
  viewed: (token: string) =>
    request<{ ok: true }>({ action: 'view', token, visitId: inviteVisitId() }),
  accept: (token: string) => request<{ enrollmentId: string }>({ action: 'accept', token }),
  campaign: (workspaceId: string, repositoryIds: string[]) =>
    request<ReviewCampaign>({ action: 'campaign', workspaceId, repositoryIds }),
  invite: (campaignId: string, login: string) =>
    request<{ id: string; token: string }>({ action: 'invite', campaignId, login }),
  revoke: (inviteId: string) => request<{ ok: true }>({ action: 'revoke', inviteId }),
  queue: (enrollmentId: string) => request<ReviewQueue>({ action: 'queue', enrollmentId }),
  scan: (enrollmentId: string) =>
    request<{ done: boolean; added: boolean }>({ action: 'scan', enrollmentId }),
  label: (prId: string, target: string, label: ReviewDecision | 'missed', note?: string) =>
    request<LabelRecord>({
      action: 'label',
      prId,
      target,
      label,
      note,
      consentVersion: REVIEW_CONSENT_VERSION,
    }),
  withdraw: (enrollmentId: string) =>
    request<{
      ok: true;
      revocations: { consent_id: string; campaign_id: string; revoked_at: string }[];
    }>({ action: 'withdraw', enrollmentId }),
  export: (enrollmentId: string) =>
    request<{
      labels: LabelRecord[];
      revocations: { consent_id: string; campaign_id: string; revoked_at: string }[];
    }>({ action: 'export', enrollmentId }),
};

export function downloadJSONL(records: object[], filename: string) {
  const blob = new Blob([records.map((row) => JSON.stringify(row)).join('\n') + '\n'], {
    type: 'application/x-ndjson',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
