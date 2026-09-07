import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ReviewLabelsService as api } from '@/services/review-labels.service';
import { reviewInvitePath, type ReviewInvite, type ReviewWorkspace } from '@/types/review-labels';

export function ReviewLabelManager({
  workspace,
  refresh,
  onError,
}: {
  workspace: ReviewWorkspace;
  refresh: () => Promise<unknown>;
  onError: (error: Error) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [campaign, setCampaign] = useState(workspace.campaigns[0]?.id || '');
  const [login, setLogin] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(!workspace.campaigns.length);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Please try again'));
    } finally {
      setBusy(false);
    }
  };
  const collection = workspace.campaigns.find((c) => c.id === campaign);
  const date = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Invite reviewers</CardTitle>
        <CardDescription>
          Select repositories, then create a personal invite link. Each person labels PRs they
          participated in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!!workspace.campaigns.length && (
          <div className="flex flex-wrap gap-3">
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger className="w-full sm:w-80" aria-label="Review collection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspace.campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.repository_ids.length}{' '}
                    {c.repository_ids.length === 1 ? 'repository' : 'repositories'} ·{' '}
                    {new Date(c.cutoff).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setCreating(!creating)}>
              Choose new repositories
            </Button>
          </div>
        )}
        {creating && (
          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Public Paper Compute repositories</p>
            {workspace.repositories.map((repo) => (
              <label key={repo.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={selected.includes(repo.id)}
                  onCheckedChange={(checked) =>
                    setSelected((previous) =>
                      checked ? [...previous, repo.id] : previous.filter((id) => id !== repo.id)
                    )
                  }
                />
                {repo.full_name}
              </label>
            ))}
            {!workspace.repositories.length && (
              <p className="text-sm text-muted-foreground">
                Add public Paper Compute repositories to this workspace first.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This saves the selected repositories and a cutoff of now. Future PRs are excluded.
              Private repository support follows separately.
            </p>
            <Button
              disabled={busy || !selected.length}
              onClick={() =>
                void run(async () => {
                  const result = await api.campaign(workspace.id, selected);
                  setCampaign(result.id);
                  setCreating(false);
                  await refresh();
                })
              }
            >
              Save repositories
            </Button>
          </div>
        )}
        {collection && (
          <p className="text-sm text-muted-foreground">
            {collection.repository_ids
              .map(
                (id) =>
                  workspace.repositories.find((r) => r.id === id)?.full_name ||
                  'Repository unavailable'
              )
              .join(', ')}
          </p>
        )}
        {campaign && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const invite = await api.invite(campaign, login.trim());
                setShareUrl(window.location.origin + reviewInvitePath(invite.token));
                setCopied(false);
                await refresh();
              });
            }}
          >
            <Label htmlFor="review-invite-login">GitHub login</Label>
            <div className="flex flex-wrap gap-3">
              <Input
                id="review-invite-login"
                className="sm:max-w-xs"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="yeazelm or jpmcb"
                required
                autoComplete="off"
              />
              <Button disabled={busy || !login.trim()}>Create invite link</Button>
            </div>
          </form>
        )}
        {shareUrl && (
          <div className="space-y-2 rounded-lg border p-4 ph-mask">
            <Label htmlFor="review-share-url">Personal invite link · expires in 7 days</Label>
            <div className="flex flex-wrap gap-3">
              <Input
                id="review-share-url"
                value={shareUrl}
                readOnly
                onFocus={(event) => event.target.select()}
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                  })
                }
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this link to share it with the invited person. Create a new link if you lose it.
            </p>
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">Invitation activity</h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await refresh();
                })
              }
            >
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Viewed means the link was opened in a browser. It does not identify the visitor.
            Accepted means the invited GitHub account joined.
          </p>
          {workspace.invites
            .filter((i) => i.campaign_id === campaign)
            .map((invite) => (
              <div key={invite.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">@{invite.reviewer_login}</span>
                  <Badge variant="secondary">{inviteStatus(invite)}</Badge>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">First viewed</dt>
                    <dd>{date(invite.first_viewed_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Last viewed · {invite.view_count} sessions
                    </dt>
                    <dd>{date(invite.last_viewed_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Accepted</dt>
                    <dd>{date(invite.accepted_at)}</dd>
                  </div>
                </dl>
                {!invite.accepted_at && !invite.revoked_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.revoke(invite.id);
                        await refresh();
                      })
                    }
                  >
                    Revoke link
                  </Button>
                )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function inviteStatus(invite: ReviewInvite): string {
  if (invite.accepted_at) return 'Accepted';
  if (invite.revoked_at) return 'Revoked';
  if (Date.parse(invite.expires_at) < Date.now()) return 'Expired';
  return invite.first_viewed_at ? 'Viewed' : 'Not viewed';
}
