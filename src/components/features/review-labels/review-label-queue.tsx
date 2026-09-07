import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EPHEMERAL_QUERY_META } from '@/lib/query-client';
import { useSearchParams } from 'react-router';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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
import { ReviewLabelsService as api, downloadJSONL } from '@/services/review-labels.service';
import {
  REVIEW_CONSENT_TEXT,
  type ReviewComment,
  type ReviewDecision,
  type ReviewPR,
} from '@/types/review-labels';
import { ReviewHunk } from './review-hunk';

export function ReviewLabelQueue({
  enrollmentId,
  userId,
}: {
  enrollmentId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['review-label-queue', userId, enrollmentId];
  const { data, error, isLoading, refetch } = useQuery({
    queryKey,
    meta: EPHEMERAL_QUERY_META,
    queryFn: () => api.queue(enrollmentId),
  });
  const [params, setParams] = useSearchParams();
  const requestedSource = params.get('source');
  const source =
    requestedSource && ['human', 'bot'].includes(requestedSource) ? requestedSource : 'all';
  const [activePR, setActivePR] = useState<string | null>(null);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);
  const [hunkId, setHunkId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanAttempt, setScanAttempt] = useState(0);
  const [scanning, setScanning] = useState(false);
  const scanDone = data?.enrollment.scan_done;

  useEffect(() => {
    if (scanDone !== false) return;
    let active = true;
    setScanning(true);
    setScanError('');
    void (async () => {
      try {
        for (let count = 0; active; count++) {
          const progress = await api.scan(enrollmentId);
          if (!active) return;
          if (progress.added || progress.done || count % 10 === 0)
            await queryClient.invalidateQueries({
              queryKey: ['review-label-queue', userId, enrollmentId],
            });
          if (progress.done) break;
        }
      } catch (error) {
        if (active) setScanError(error instanceof Error ? error.message : 'History capture failed');
      } finally {
        if (active) setScanning(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [enrollmentId, userId, queryClient, scanDone, scanAttempt]);

  const labels = data?.labels || [];
  const matches = (comment: ReviewComment) => {
    if (source === 'human') return !comment.isBot;
    if (source === 'bot') return comment.isBot;
    return true;
  };
  const labelFor = (prId: string, commentId: string) =>
    labels.find((l) => l.pr_id === prId && l.comment?.id === commentId);
  const pending = (pr: ReviewPR) => pr.comments.filter((c) => matches(c) && !labelFor(pr.id, c.id));
  const pr = data?.prs.find((item) => item.id === activePR);
  const comment =
    pr?.comments.find((c) => c.id === selectedComment) || (pr ? pending(pr)[0] : undefined);
  const hunk = pr?.hunks.find((h) => h.id === (missed ? hunkId : comment?.hunkId));
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailure('');
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  };
  const save = async (decision: ReviewDecision) => {
    if (!pr || !comment || busy) return;
    await run(async () => {
      await api.label(pr.id, comment.id, decision);
      await refetch();
      setSelectedComment(null);
      setMessage(`${decision} saved`);
    });
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        busy ||
        missed ||
        !comment
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('input,textarea,select,button,[role="dialog"],[role="combobox"]') ||
          event.target.isContentEditable)
      )
        return;
      const decision = ({ g: 'good', b: 'bad', s: 'skip' } as const)[
        event.key.toLowerCase() as 'g' | 'b' | 's'
      ];
      if (decision) {
        event.preventDefault();
        void save(decision);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  if (isLoading) return <p role="status">Loading your reviews…</p>;
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error.message}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!data) return null;
  return (
    <div className="space-y-6 ph-no-capture ph-mask">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Labeling as @{data.enrollment.reviewer_login} · Only your labels are visible
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const exported = await api.export(enrollmentId);
              downloadJSONL(exported.labels, 'review-labels.jsonl');
              if (exported.revocations.length)
                downloadJSONL(exported.revocations, 'review-label-consent-revocations.jsonl');
            })
          }
        >
          Export my labels
        </Button>
      </div>
      {!data.enrollment.consent_at && (
        <Alert role="note">
          <AlertTitle>Your labels, your consent</AlertTitle>
          <AlertDescription>{REVIEW_CONSENT_TEXT}</AlertDescription>
        </Alert>
      )}
      {!data.enrollment.scan_done && (
        <Alert>
          <AlertDescription>
            {scanning
              ? 'Preparing your past Go and Rust PRs. You can label the reviews already available.'
              : 'History capture is paused.'}{' '}
            {data.prs.length} eligible PRs found. Keep this page open to continue.
          </AlertDescription>
        </Alert>
      )}
      {scanError && (
        <Alert variant="destructive">
          <AlertDescription>
            {scanError}{' '}
            <Button variant="outline" onClick={() => setScanAttempt((n) => n + 1)}>
              Retry capture
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <p className="sr-only" role="status">
        {message}
      </p>
      <Tabs
        value={source}
        onValueChange={(value) => {
          setParams(
            (previous) => {
              previous.set('source', value);
              return previous;
            },
            { replace: true }
          );
          setSelectedComment(null);
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="all">All reviews</TabsTrigger>
          <TabsTrigger value="human">Human reviews</TabsTrigger>
          <TabsTrigger value="bot">Bot reviews</TabsTrigger>
        </TabsList>
      </Tabs>
      {!pr ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your past pull requests</h2>
          {!data.prs.length && (
            <p className="text-muted-foreground">
              {data.enrollment.scan_done
                ? 'No eligible Go or Rust PRs were found in this collection.'
                : 'Your queue will appear as history is captured.'}
            </p>
          )}
          {data.prs
            .filter((item) => item.comments.some(matches) || !item.comments.length)
            .map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardDescription>
                    {item.repo} #{item.number} · {item.participation}
                  </CardDescription>
                  <CardTitle as="h3" className="text-lg">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {pending(item).length} comments left in this view ·{' '}
                    {labels.filter((l) => l.pr_id === item.id && l.label === 'missed').length}{' '}
                    missed entries
                  </p>
                  {item.comments.filter(matches).map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <span className="text-sm">
                        @{c.author}{' '}
                        <Badge variant="secondary">{c.isBot ? 'Bot review' : 'Human review'}</Badge>
                        {labelFor(item.id, c.id) && (
                          <Badge variant="outline" className="ml-2">
                            {labelFor(item.id, c.id)?.label}
                          </Badge>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Label comment by ${c.author} on ${item.repo} ${item.number}`}
                        onClick={() => {
                          setActivePR(item.id);
                          setSelectedComment(c.id);
                          setMissed(false);
                        }}
                      >
                        Label this comment
                      </Button>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActivePR(item.id);
                      setSelectedComment(null);
                      setMissed(false);
                    }}
                  >
                    Open PR
                  </Button>
                </CardFooter>
              </Card>
            ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={busy || !!note.trim()}
              onClick={() => {
                setActivePR(null);
                setMissed(false);
                setSelectedComment(null);
              }}
            >
              Back to queue
            </Button>
            <a
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline"
            >
              {pr.repo} #{pr.number} on GitHub
            </a>
          </div>
          <div>
            <h2 className="text-xl font-semibold">{pr.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pr.participation}</p>
          </div>
          {!!pr.unavailableFiles?.length && (
            <Alert>
              <AlertDescription>
                GitHub did not provide a diff for: {pr.unavailableFiles.join(', ')}. Missed entries
                are available on the hunks below.
              </AlertDescription>
            </Alert>
          )}
          {labels
            .filter((label) => label.pr_id === pr.id && label.label === 'missed')
            .map((label) => (
              <div key={label.id} className="rounded-lg border p-4 text-sm">
                <Badge variant="outline">Missed</Badge>
                <code className="ml-2 break-all">{label.file_path}</code>
                <p className="mt-2">{label.note}</p>
              </div>
            ))}
          {!missed && comment && hunk ? (
            <>
              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                <ReviewHunk hunk={hunk} />
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle as="h3" className="text-base">
                      Review comment
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={`https://avatars.githubusercontent.com/u/${comment.authorId}?s=80`}
                          alt={comment.author}
                        />
                        <AvatarFallback>{comment.author.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">@{comment.author}</span>
                      <Badge variant="secondary">
                        {comment.isBot ? 'Bot review' : 'Human review'}
                        {comment.author === data.enrollment.reviewer_login && ' · Yours'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                    {!!comment.replies.length && (
                      <div className="space-y-3 border-t pt-4">
                        <h4 className="text-sm font-medium">Replies</h4>
                        {comment.replies.map((r, index) => (
                          <blockquote className="border-l-2 pl-3 text-sm" key={index}>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground"
                            >
                              @{r.author} · {new Date(r.time).toLocaleString()}
                            </a>
                            <p className="mt-1 whitespace-pre-wrap break-words">{r.body}</p>
                          </blockquote>
                        ))}
                      </div>
                    )}
                    {comment.resolved && (
                      <p className="text-xs text-muted-foreground">
                        Thread resolved
                        {comment.outdated === false
                          ? ' · GitHub has not marked its hunk outdated'
                          : ''}
                        . Resolution alone does not tell us whether a fix was made.
                      </p>
                    )}
                    {comment.laterApprovals.map((approval, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        <a
                          href={approval.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          @{approval.author} approved later
                        </a>{' '}
                        with no review body or inline comments ·{' '}
                        {new Date(approval.time).toLocaleString()}
                      </p>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <a
                      href={comment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline"
                    >
                      Original comment on GitHub
                    </a>
                  </CardFooter>
                </Card>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['good', 'bad', 'skip'] as const).map((decision) => (
                  <Button
                    key={decision}
                    variant={
                      labelFor(pr.id, comment.id)?.label === decision ? 'default' : 'outline'
                    }
                    className="h-auto flex-col items-start px-4 py-3 text-left"
                    disabled={busy}
                    onClick={() => void save(decision)}
                  >
                    <strong className="capitalize">{decision}</strong>
                    <span className="mt-1 whitespace-normal text-xs font-normal">
                      {
                        {
                          good: 'This comment was worth making',
                          bad: 'This comment should not have been made, or was wrong',
                          skip: 'Not sure or not mine to judge',
                        }[decision]
                      }
                    </span>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            !missed && (
              <Card>
                <CardHeader>
                  <CardTitle as="h3">All comments in this view are labeled</CardTitle>
                  <CardDescription>
                    You can mark anything the review missed or return to your queue.
                  </CardDescription>
                </CardHeader>
                {source !== 'all' &&
                  pr.comments.some((c) => !matches(c) && !labelFor(pr.id, c.id)) && (
                    <CardFooter>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setParams(
                            (previous) => {
                              previous.set('source', 'all');
                              return previous;
                            },
                            { replace: true }
                          )
                        }
                      >
                        Continue with all reviews
                      </Button>
                    </CardFooter>
                  )}
              </Card>
            )
          )}
          {!missed ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setMissed(true);
                setHunkId(pr.hunks[0]?.id || '');
              }}
            >
              Mark something missed
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle as="h3">What did the review miss?</CardTitle>
                <CardDescription>Optional. Select a hunk and add one line.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={hunkId} onValueChange={setHunkId}>
                  <SelectTrigger aria-label="Missed hunk">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pr.hunks.map((h, index) => (
                      <SelectItem value={h.id} key={h.id}>
                        {h.path} · line {h.startLine} · hunk {index + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hunk && <ReviewHunk hunk={hunk} />}
                <Label htmlFor="review-missed-note">Missed</Label>
                <Input
                  id="review-missed-note"
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value.replace(/[\r\n]/g, ' '))}
                />
              </CardContent>
              <CardFooter className="gap-3">
                <Button
                  disabled={busy || !note.trim() || !hunk}
                  onClick={() =>
                    void run(async () => {
                      await api.label(pr.id, hunkId, 'missed', note.trim());
                      await refetch();
                      setNote('');
                      setMissed(false);
                      setMessage('Missed entry saved');
                    })
                  }
                >
                  Save missed
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setMissed(false);
                    setNote('');
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
      <div className="border-t pt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Withdraw consent and delete my labels
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your labels for this collection?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your saved labels and withdraws consent. Previously downloaded exports
                cannot be recalled automatically; download the revocation record to share with the
                training consumer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  void run(async () => {
                    const exported = await api.withdraw(enrollmentId);
                    await refetch();
                    downloadJSONL(exported.revocations, 'review-label-consent-revocations.jsonl');
                    setMessage('Consent withdrawn and labels deleted');
                  })
                }
              >
                Delete my labels
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
