import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { EPHEMERAL_QUERY_META } from '@/lib/query-client';
import { useCachedAuth } from '@/hooks/use-cached-auth';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import {
  ReviewLabelsService as api,
  downloadJSONL,
  ReviewLabelsUnavailableError,
} from '@/services/review-labels.service';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ReviewLabelManager } from '@/components/features/review-labels/review-label-manager';
import { ReviewLabelQueue } from '@/components/features/review-labels/review-label-queue';

const localQA = import.meta.env.DEV && import.meta.env.VITE_REVIEW_LABEL_QA === 'true';
const ReviewLabelsQAControls = localQA
  ? lazy(() => import('@/components/features/review-labels/review-label-qa-controls'))
  : null;

export default function ReviewLabelsPage() {
  const { token } = useParams<{ token: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading } = useCachedAuth();
  const { login } = useGitHubAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const home = useQuery({
    queryKey: ['review-labels-home', user?.id],
    queryFn: api.home,
    enabled: !!user && !token,
    meta: EPHEMERAL_QUERY_META,
    staleTime: 0,
  });
  const invite = useQuery({
    queryKey: ['review-labels-invite', token],
    queryFn: () => api.preview(token!),
    enabled: !!token,
    meta: EPHEMERAL_QUERY_META,
    staleTime: 0,
    retry: false,
  });
  const [viewRetry, setViewRetry] = useState(0);
  useEffect(() => {
    if (!token || !invite.data) return;
    let active = true;
    void api.viewed(token).catch(() => {
      if (active) setError('The invitation opened, but its view could not be recorded.');
    });
    return () => {
      active = false;
    };
  }, [token, invite.data, viewRetry]);
  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  };
  const workspace =
    home.data?.workspaces.find((w) => w.id === params.get('workspace')) || home.data?.workspaces[0];
  const availableCampaigns =
    home.data?.workspaces.flatMap((w) => w.campaigns.map((c) => c.id)) || [];
  const enrollment =
    home.data?.enrollments.find((e) => e.id === params.get('enrollment')) ||
    home.data?.enrollments.find((e) => workspace?.campaigns.some((c) => c.id === e.campaign_id));
  return (
    <div className="space-y-6 ph-no-capture ph-mask">
      {ReviewLabelsQAControls && (
        <Suspense fallback={null}>
          <ReviewLabelsQAControls />
        </Suspense>
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review labels</h1>
        <p className="mt-1 text-muted-foreground">Label past reviews on PRs you participated in.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {error.includes('view could not') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setError('');
                  setViewRetry((n) => n + 1);
                }}
              >
                Retry tracking
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {token && (
        <>
          {invite.isLoading && <p role="status">Loading invitation…</p>}
          {invite.error && (
            <Alert variant="destructive">
              <AlertDescription>{invite.error.message}</AlertDescription>
            </Alert>
          )}
          {invite.data && (
            <Card>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  Workspace invitation
                </Badge>
                <CardTitle as="h2" className="text-2xl">
                  Join {invite.data.workspaceName}
                </CardTitle>
                <CardDescription>
                  This invitation is for @{invite.data.reviewerLogin}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Label past Go and Rust reviews from people and bots as good, bad, or skip. Mark
                  anything the review missed.
                </p>
                <p className="text-sm text-muted-foreground">
                  Joining the workspace does not opt you in to training. You choose that when you
                  save your first Good, Bad, or Missed label.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  disabled={busy || isLoading || (localQA && !user)}
                  onClick={() =>
                    void run(async () => {
                      if (!user) {
                        await login();
                        return;
                      }
                      const result = await api.accept(token);
                      navigate(`/review-labels?enrollment=${result.enrollmentId}`);
                    })
                  }
                >
                  {!user && (localQA ? 'Choose a QA account above' : 'Continue with GitHub')}
                  {user && (invite.data.accepted ? 'Continue to reviews' : 'Join workspace')}
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      )}
      {!token && isLoading && <p role="status">Checking your account…</p>}
      {!token && !isLoading && !user && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Sign in to label reviews</CardTitle>
            <CardDescription>
              Use your GitHub account to open your workspace and personal queue. If someone invited
              you, open their personal invite link.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button disabled={localQA} onClick={() => void run(login)}>
              {localQA ? 'Choose a QA account above' : 'Continue with GitHub'}
            </Button>
          </CardFooter>
        </Card>
      )}
      {!token && !isLoading && user && (
        <>
          {home.isLoading && <p role="status">Loading your workspaces…</p>}
          {import.meta.env.DEV && home.error instanceof ReviewLabelsUnavailableError ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Start the local review-label backend</CardTitle>
                <CardDescription>
                  Vite is running, but the API is unavailable. The QA command starts a separate
                  local database, seeds test accounts, and opens the implemented flow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <code className="text-sm">npm run qa:review-labels</code>
              </CardContent>
              <CardFooter className="flex-wrap gap-3">
                <Button asChild>
                  <a href="http://localhost:5175/review-labels?source=human">Open local QA</a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/review-labels/prototype?source=human">Open sample prototype</a>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            home.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {home.error.message}{' '}
                  <Button variant="outline" onClick={() => void home.refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )
          )}
          {home.data && !home.data.workspaces.length && (
            <p className="text-muted-foreground">
              Open your personal invite link to join a workspace, or create a workspace to invite
              your team.
            </p>
          )}
          {home.data?.enrollments
            .filter((e) => !availableCampaigns.includes(e.campaign_id))
            .map((e) => (
              <Card key={e.id}>
                <CardHeader>
                  <CardTitle as="h2">Review collection unavailable</CardTitle>
                  <CardDescription>
                    Your workspace access has changed. You can still delete your personal labels and
                    withdraw consent.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Withdraw consent and delete my labels</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete your labels for this collection?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Previously downloaded exports cannot be recalled automatically. A
                          revocation record will download for the training consumer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            void run(async () => {
                              const result = await api.withdraw(e.id);
                              downloadJSONL(
                                result.revocations,
                                'review-label-consent-revocations.jsonl'
                              );
                              await home.refetch();
                            })
                          }
                        >
                          Delete my labels
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          {workspace && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Select
                  value={workspace.id}
                  onValueChange={(id) =>
                    setParams((previous) => {
                      previous.set('workspace', id);
                      previous.delete('enrollment');
                      return previous;
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-72" aria-label="Workspace">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {home.data?.workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <a
                  className="text-sm text-muted-foreground underline"
                  href={`/i/${workspace.id}/settings`}
                >
                  Workspace settings
                </a>
              </div>
              {workspace.canManage && (
                <ReviewLabelManager
                  key={workspace.id}
                  workspace={workspace}
                  refresh={home.refetch}
                  onError={(error) => setError(error.message)}
                />
              )}
              {home.data?.enrollments.length !== 0 && (
                <Select
                  value={enrollment?.id || ''}
                  onValueChange={(id) =>
                    setParams((previous) => {
                      previous.set('enrollment', id);
                      return previous;
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-96" aria-label="Your review collection">
                    <SelectValue placeholder="Choose your review collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {home.data?.enrollments
                      .filter((e) => availableCampaigns.includes(e.campaign_id))
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          @{e.reviewer_login} ·{' '}
                          {
                            home.data?.workspaces.find((w) =>
                              w.campaigns.some((c) => c.id === e.campaign_id)
                            )?.name
                          }{' '}
                          ·{' '}
                          {new Date(
                            home.data?.workspaces
                              .flatMap((w) => w.campaigns)
                              .find((c) => c.id === e.campaign_id)?.cutoff || ''
                          ).toLocaleDateString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {enrollment ? (
                <ReviewLabelQueue
                  key={enrollment.id}
                  enrollmentId={enrollment.id}
                  userId={user.id}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Accept your personal invitation to start labeling. Workspace members who want to
                  label also need their own invite.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
