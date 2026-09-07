import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Download,
  FileText,
  GitPullRequest,
  Lock,
  Plus,
  RotateCcw,
  Users,
  X,
} from '@/components/ui/icon';
import {
  DEMO_PRS,
  emptySession,
  toDemoJSONL,
  type Decision,
  type DemoComment,
  type DemoLabel,
  type DemoPR,
  type DemoReviewer,
  type DemoSession,
} from '@/components/features/review-labels/demo-data';
import {
  AuthorAvatar,
  ConsentNotice,
  DiffHunk,
  Invitation,
  ReviewCommentCard,
} from '@/components/features/review-labels/review-label-components';

type View = 'invite' | 'queue' | 'review' | 'missed' | 'source-done' | 'done';
type Source = 'all' | 'human' | 'bot';
const STORAGE_PREFIX = 'review-labels-poc-v1:';

function parseSource(value: string | null): Source {
  if (value === 'human' || value === 'bot') return value;
  return 'all';
}

function matchesSource(comment: DemoComment, source: Source): boolean {
  if (source === 'all') return true;
  return comment.author.includes('[bot]') === (source === 'bot');
}
function readSession(reviewer: DemoReviewer): DemoSession {
  try {
    const raw: Partial<DemoSession> = JSON.parse(
      sessionStorage.getItem(STORAGE_PREFIX + reviewer) || '{}'
    );
    const eligible = DEMO_PRS.filter((pr) => pr.participants.includes(reviewer));
    if (
      typeof raw.joined !== 'boolean' ||
      !Array.isArray(raw.labels) ||
      !Array.isArray(raw.completed) ||
      !(raw.consentAt === null || typeof raw.consentAt === 'string')
    )
      return emptySession();
    const labels = raw.labels.filter((label) => {
      if (!label || typeof label.id !== 'string' || typeof label.timestamp !== 'string')
        return false;
      const pr = eligible.find((item) => item.id === label.prId);
      if (!pr?.hunks.some((hunk) => hunk.id === label.hunkId)) return false;
      if (label.label === 'missed')
        return (
          label.commentId === null && typeof label.note === 'string' && label.note.trim().length > 0
        );
      return (
        ['good', 'bad', 'skip'].includes(label.label) &&
        label.note === null &&
        pr.comments.some(
          (comment) => comment.id === label.commentId && comment.hunkId === label.hunkId
        )
      );
    });
    return {
      joined: raw.joined,
      consentAt: raw.consentAt,
      labels,
      completed: raw.completed.filter((id) => eligible.some((pr) => pr.id === id)),
    };
  } catch {
    return emptySession();
  }
}

export default function ReviewLabelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = parseSource(searchParams.get('source'));
  const [reviewer, setReviewer] = useState<DemoReviewer>('yeazelm');
  const [session, setSession] = useState<DemoSession>(() => readSession('yeazelm'));
  const [view, setView] = useState<View>(() =>
    readSession('yeazelm').joined ? 'queue' : 'invite'
  );
  const [signedIn, setSignedIn] = useState(false);
  const [activePrId, setActivePrId] = useState(DEMO_PRS[0].id);
  const [commentIndex, setCommentIndex] = useState(0);
  const [selectedHunk, setSelectedHunk] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [undo, setUndo] = useState<{
    session: DemoSession;
    view: View;
    index: number;
    source: Source;
  } | null>(null);
  const lastSave = useRef(0);
  const eligible = DEMO_PRS.filter((pr) => pr.participants.includes(reviewer));
  const visiblePRs = eligible.filter((pr) =>
    pr.comments.some((item) => matchesSource(item, source))
  );
  const activePr = eligible.find((pr) => pr.id === activePrId) ?? eligible[0];
  const comment = activePr.comments[commentIndex];
  const activeHunk =
    activePr.hunks.find((hunk) => hunk.id === comment?.hunkId) ?? activePr.hunks[0];
  const visibleComments = activePr.comments.filter((item) => matchesSource(item, source));
  const allComments = eligible.flatMap((pr) => pr.comments);
  const humanCount = allComments.filter((item) => matchesSource(item, 'human')).length;
  const botCount = allComments.length - humanCount;
  const labeledCount = session.labels.filter((label) => label.label !== 'missed').length;
  const completedCount = eligible.filter((pr) => session.completed.includes(pr.id)).length;
  const allDone = completedCount === eligible.length;
  const selectedMissedHunk = activePr.hunks.find((hunk) => hunk.id === selectedHunk);
  const pendingComments = activePr.comments.filter(
    (item) => !session.labels.some((label) => label.commentId === item.id)
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + reviewer, JSON.stringify(session));
    } catch {
      /* The demo remains usable without browser storage. */
    }
  }, [reviewer, session]);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = 'Review labels · contributor.info';
    return () => {
      document.title = oldTitle;
    };
  }, []);

  const openPR = (pr: DemoPR, filter: Source = source, commentId?: string) => {
    let index = pr.comments.findIndex(
      (item) =>
        matchesSource(item, filter) && !session.labels.some((label) => label.commentId === item.id)
    );
    if (index === -1) index = pr.comments.findIndex((item) => matchesSource(item, filter));
    if (commentId) index = pr.comments.findIndex((item) => item.id === commentId);
    if (index < 0) {
      setView('queue');
      return;
    }
    setActivePrId(pr.id);
    setCommentIndex(index);
    setView('review');
    setNote('');
    setSelectedHunk(null);
    setAnnouncement('');
    setUndo(null);
  };

  const changeSource = (value: string) => {
    const next = parseSource(value);
    setSearchParams(next === 'all' ? {} : { source: next }, { replace: true });
    if (view === 'review' || view === 'source-done') openPR(activePr, next);
  };

  const recordDecision = useCallback(
    (decision: Decision) => {
      if (view !== 'review' || !comment || performance.now() - lastSave.current < 300) return;
      lastSave.current = performance.now();
      const timestamp = new Date().toISOString();
      const label: DemoLabel = {
        id: `${reviewer}:${comment.id}`,
        prId: activePr.id,
        hunkId: comment.hunkId,
        commentId: comment.id,
        label: decision,
        note: null,
        timestamp,
      };
      const nextLabels = [...session.labels.filter((item) => item.commentId !== comment.id), label];
      setUndo({ session, view, index: commentIndex, source });
      setSession({
        ...session,
        consentAt: session.consentAt || (decision === 'skip' ? null : timestamp),
        labels: nextLabels,
      });
      setAnnouncement(`${decision[0].toUpperCase() + decision.slice(1)} saved in this demo.`);
      const nextIndex = activePr.comments.findIndex(
        (item) =>
          matchesSource(item, source) && !nextLabels.some((record) => record.commentId === item.id)
      );
      if (nextIndex >= 0) setCommentIndex(nextIndex);
      else if (
        activePr.comments.some((item) => !nextLabels.some((record) => record.commentId === item.id))
      )
        setView('source-done');
      else {
        setView('missed');
        setSelectedHunk(null);
        setNote('');
      }
    },
    [view, comment, reviewer, activePr, session, commentIndex, source]
  );

  const undoLabel = useCallback(() => {
    if (!undo) return;
    setSession(undo.session);
    setView(undo.view);
    setCommentIndex(undo.index);
    setSearchParams(undo.source === 'all' ? {} : { source: undo.source }, { replace: true });
    setUndo(null);
    setAnnouncement('Last label undone.');
  }, [undo, setSearchParams]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest(
              '[role="listbox"], [role="option"], [role="combobox"], [role="menu"], [role="tablist"]'
            )))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'z' && undo) {
        event.preventDefault();
        undoLabel();
      }
      if (view !== 'review') return;
      const choices: Record<string, Decision> = { g: 'good', b: 'bad', s: 'skip' };
      if (choices[key]) {
        event.preventDefault();
        recordDecision(choices[key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recordDecision, undoLabel, undo, view]);

  const saveMissed = () => {
    if (!selectedMissedHunk || !note.trim() || /[\r\n]/.test(note) || note.length > 280) return;
    const timestamp = new Date().toISOString();
    setUndo({ session, view, index: commentIndex, source });
    setSession({
      ...session,
      consentAt: session.consentAt || timestamp,
      labels: [
        ...session.labels,
        {
          id: crypto.randomUUID(),
          prId: activePr.id,
          hunkId: selectedMissedHunk.id,
          commentId: null,
          label: 'missed',
          note: note.trim(),
          timestamp,
        },
      ],
    });
    setNote('');
    setSelectedHunk(null);
    setAnnouncement('Missed item saved. You can add another or finish this PR.');
  };

  const exportLabels = () => {
    const blob = new Blob([toDemoJSONL(reviewer, session) + '\n'], {
      type: 'application/x-ndjson',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reviewer}_review-labels_DEMO.jsonl`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setAnnouncement('Sample JSONL downloaded. Every record is marked demo: true.');
  };

  const changeReviewer = (login: string) => {
    if (login !== 'yeazelm' && login !== 'jpmcb') return;
    const next = readSession(login);
    setReviewer(login);
    setSession(next);
    setView(next.joined ? 'queue' : 'invite');
    setSignedIn(false);
    setUndo(null);
    setAnnouncement('');
    setSelectedHunk(null);
    setNote('');
  };

  const finishPR = () => {
    if (pendingComments.length || note.trim()) return;
    setSession({ ...session, completed: [...new Set([...session.completed, activePr.id])] });
    setView('done');
    setAnnouncement('PR complete.');
    setUndo(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review labels</h1>
          <p className="mt-1 text-muted-foreground">
            Label past reviews on PRs you participated in.
          </p>
        </div>
        {session.joined && (
          <Button
            variant="outline"
            onClick={exportLabels}
            disabled={session.labels.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export my labels
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Prototype</Badge>
          <p className="text-xs text-muted-foreground">
            Sample data. Sign-in and consent are simulated.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="demo-reviewer" className="text-xs">
            Preview as
          </Label>
          <Select value={reviewer} onValueChange={changeReviewer}>
            <SelectTrigger id="demo-reviewer" className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yeazelm">Matt · yeazelm</SelectItem>
              <SelectItem value="jpmcb">John · jpmcb</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2"
            onClick={() => {
              setSession(emptySession());
              setView('invite');
              setSignedIn(false);
              setUndo(null);
              setAnnouncement('Demo reset for this reviewer.');
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Restart
          </Button>
        </div>
      </div>
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
      {view === 'invite' ? (
        <Invitation
          reviewer={reviewer}
          signedIn={signedIn}
          onSignIn={() => setSignedIn(true)}
          onJoin={() => {
            setSession({ ...session, joined: true });
            setView('queue');
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Paper Compute</h2>
              <Badge variant="outline">tapes</Badge>
              <Badge variant="outline">tapesctl</Badge>
            </div>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Only your labels are visible
            </span>
          </div>
          <Tabs value={source} onValueChange={changeSource} className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
              <TabsTrigger
                value="all"
                className="gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
              >
                All reviews <span className="hidden text-xs sm:inline">{allComments.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="human"
                className="gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Users className="hidden h-4 w-4 sm:block" />
                Human reviews <span className="hidden text-xs sm:inline">{humanCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="bot"
                className="gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Bot className="hidden h-4 w-4 sm:block" />
                Bot reviews <span className="hidden text-xs sm:inline">{botCount}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={source} className="space-y-6">
              {view === 'queue' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                          Past pull requests
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{eligible.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Across your selected repositories
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                          Comments labeled
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {labeledCount}{' '}
                          <span className="font-normal text-muted-foreground">
                            / {allComments.length}
                          </span>
                        </p>
                        <Progress
                          value={(labeledCount / allComments.length) * 100}
                          className="mt-3"
                          aria-label="Comments labeled"
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                          PRs complete
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {completedCount}{' '}
                          <span className="font-normal text-muted-foreground">
                            / {eligible.length}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Includes the optional missed-item pass
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Your review queue</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {source === 'human'
                        ? 'Comments by Matt and John. Pick a human review to start labeling.'
                        : 'Open a comment by its author, or work through the PR in order.'}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {visiblePRs.map((pr) => {
                      const comments = pr.comments.filter((item) => matchesSource(item, source));
                      const humans = pr.comments.filter((item) =>
                        matchesSource(item, 'human')
                      ).length;
                      return (
                        <Card key={pr.id} data-testid="review-queue-pr">
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <GitPullRequest className="h-4 w-4" />
                                  <span>
                                    {pr.repo} #{pr.number}
                                  </span>
                                  <Badge variant="outline">{pr.hunks[0].language}</Badge>
                                  <Badge variant="secondary">{pr.participation[reviewer]}</Badge>
                                  {session.completed.includes(pr.id) && (
                                    <Badge variant="outline" className="gap-1">
                                      <Check className="h-3 w-3" />
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                <CardTitle as="h3" className="text-base leading-snug">
                                  {pr.title}
                                </CardTitle>
                                <CardDescription>
                                  {pr.date} · {humans} human / {pr.comments.length - humans} bot
                                  comments
                                </CardDescription>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPR(pr)}
                                className="gap-2"
                              >
                                Open PR
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-1">
                            {comments.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50"
                                data-testid="queue-comment"
                              >
                                <AuthorAvatar login={item.author} small />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{item.author}</span>
                                    <Badge variant="outline" className="font-normal">
                                      {item.author.includes('[bot]') ? 'Bot' : 'Human'}
                                    </Badge>
                                    {item.author === reviewer && (
                                      <span className="text-xs text-muted-foreground">
                                        Your comment
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                    {item.body}
                                  </p>
                                  <Button
                                    variant="link"
                                    className="mt-1 h-auto px-0 py-1 text-xs"
                                    onClick={() => openPR(pr, source, item.id)}
                                    aria-label={`Label comment by ${item.author} on ${pr.repo} ${pr.number}`}
                                  >
                                    Label this comment
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  <ConsentNotice />
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    Private repos paper, paper-forest, and cloud will be available after GitHub App
                    access is connected.
                  </p>
                </>
              )}
              {(view === 'review' || view === 'missed' || view === 'source-done') && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 gap-2"
                    onClick={() => setView('queue')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to your queue
                  </Button>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <GitPullRequest className="h-4 w-4" />
                      {activePr.repo} #{activePr.number}
                      <Badge variant="secondary">{activePr.participation[reviewer]}</Badge>
                      <span>{activePr.date}</span>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">{activePr.title}</h2>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {visibleComments.map((item) => {
                        const label = session.labels.find((record) => record.commentId === item.id);
                        return (
                          <Button
                            key={item.id}
                            size="sm"
                            variant={
                              view === 'review' && comment?.id === item.id ? 'secondary' : 'outline'
                            }
                            onClick={() => {
                              setCommentIndex(activePr.comments.indexOf(item));
                              setView('review');
                            }}
                            className="gap-2"
                            aria-label={`Review comment by ${item.author}${label ? `, labeled ${label.label}` : ''}`}
                          >
                            {item.author.includes('[bot]') ? (
                              <Bot className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                            {item.author}
                            {label && <Check className="h-3 w-3" />}
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant={view === 'missed' ? 'secondary' : 'outline'}
                        className="gap-2"
                        onClick={() => {
                          setView('missed');
                          setNote('');
                          setSelectedHunk(null);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Anything missed?
                      </Button>
                    </div>
                    {undo && (
                      <Button size="sm" variant="ghost" onClick={undoLabel} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Undo<kbd className="rounded border px-1 text-xs">Z</kbd>
                      </Button>
                    )}
                  </div>
                </>
              )}
              {view === 'review' && comment && (
                <>
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                    <DiffHunk hunk={activeHunk} />
                    <ReviewCommentCard comment={comment} reviewer={reviewer} />
                  </div>
                  {!session.consentAt && <ConsentNotice />}
                  <Card>
                    <CardHeader>
                      <CardTitle as="h3" className="text-lg">
                        Was this comment worth making?
                      </CardTitle>
                      <CardDescription>One decision. No explanation needed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Button
                          variant="outline"
                          className="h-auto justify-start gap-3 whitespace-normal p-4 text-left"
                          onClick={() => recordDecision('good')}
                        >
                          <Check className="h-5 w-5 shrink-0" />
                          <span className="flex-1">
                            <strong className="block">Good</strong>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              This comment was worth making
                            </span>
                          </span>
                          <kbd className="rounded border px-1 text-xs">G</kbd>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto justify-start gap-3 whitespace-normal p-4 text-left"
                          onClick={() => recordDecision('bad')}
                        >
                          <X className="h-5 w-5 shrink-0" />
                          <span className="flex-1">
                            <strong className="block">Bad</strong>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              Shouldn’t have been made, or was wrong
                            </span>
                          </span>
                          <kbd className="rounded border px-1 text-xs">B</kbd>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto justify-start gap-3 whitespace-normal p-4 text-left"
                          onClick={() => recordDecision('skip')}
                        >
                          <ArrowRight className="h-5 w-5 shrink-0" />
                          <span className="flex-1">
                            <strong className="block">Skip</strong>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              Not sure, or not mine to judge
                            </span>
                          </span>
                          <kbd className="rounded border px-1 text-xs">S</kbd>
                        </Button>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>Labels stay private to you.</span>
                      <span>Saved as you go · Undo with Z</span>
                    </CardFooter>
                  </Card>
                </>
              )}
              {view === 'source-done' && (
                <Card>
                  <CardHeader>
                    <CardTitle as="h3">Selected reviews labeled</CardTitle>
                    <CardDescription>
                      {pendingComments.length} other comment
                      {pendingComments.length === 1 ? '' : 's'} remain on this PR. Your labels are
                      saved.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex-wrap gap-3">
                    <Button
                      onClick={() => {
                        setSearchParams({}, { replace: true });
                        openPR(activePr, 'all');
                      }}
                      className="gap-2"
                    >
                      Continue with remaining comments
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setView('queue')}>
                      Back to your queue
                    </Button>
                  </CardFooter>
                </Card>
              )}
              {view === 'missed' && (
                <>
                  <div>
                    <h3 className="text-xl font-semibold">What should the review have caught?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Optional. Choose a hunk and leave one line, or finish the PR.
                    </p>
                  </div>
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                    <div className="min-w-0 space-y-4">
                      {activePr.hunks.map((hunk) => (
                        <DiffHunk
                          key={hunk.id}
                          hunk={hunk}
                          selected={hunk.id === selectedHunk}
                          select={() => setSelectedHunk(hunk.id)}
                        />
                      ))}
                    </div>
                    <Card>
                      <CardHeader>
                        <CardTitle as="h3" className="text-lg">
                          Mark something missed
                        </CardTitle>
                        <CardDescription>
                          Point to the code and describe the missed issue.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                          {selectedMissedHunk ? (
                            <span className="break-all">
                              {selectedMissedHunk.path}
                              <span className="mt-1 block text-xs">
                                Hunk starting at line {selectedMissedHunk.startLine}
                              </span>
                            </span>
                          ) : (
                            'Select a hunk to get started'
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="missed-note">What was missed?</Label>
                          <Input
                            id="missed-note"
                            maxLength={280}
                            value={note}
                            disabled={!selectedHunk}
                            placeholder="Describe the missed issue in one line"
                            onChange={(event) =>
                              setNote(event.target.value.replace(/[\r\n]/g, ' '))
                            }
                          />
                          <p className="text-right text-xs text-muted-foreground">
                            {note.length}/280
                          </p>
                        </div>
                        <Button
                          className="w-full gap-2"
                          disabled={!selectedHunk || !note.trim()}
                          onClick={saveMissed}
                        >
                          <Plus className="h-4 w-4" />
                          Save missed item
                        </Button>
                        <div className="space-y-3" aria-live="polite">
                          {session.labels
                            .filter(
                              (label) => label.prId === activePr.id && label.label === 'missed'
                            )
                            .map((label) => (
                              <p key={label.id} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                {label.note}
                              </p>
                            ))}
                        </div>
                      </CardContent>
                      <CardFooter className="flex-col items-stretch gap-3 border-t pt-4">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={finishPR}
                          disabled={pendingComments.length > 0 || note.trim().length > 0}
                        >
                          Finish this PR
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        {pendingComments.length > 0 && (
                          <Button
                            variant="link"
                            className="h-auto whitespace-normal p-0"
                            onClick={() => {
                              setSearchParams({}, { replace: true });
                              openPR(activePr, 'all');
                            }}
                          >
                            Label or skip the {pendingComments.length} remaining comment
                            {pendingComments.length === 1 ? '' : 's'} first.
                          </Button>
                        )}
                        {note.trim() && (
                          <p className="text-xs text-muted-foreground">
                            Save or clear your note before finishing.
                          </p>
                        )}
                      </CardFooter>
                    </Card>
                  </div>
                  {!session.consentAt && <ConsentNotice />}
                </>
              )}
              {view === 'done' && (
                <Card className="mx-auto max-w-2xl">
                  <CardHeader className="items-center text-center">
                    <CheckCircle2 className="mb-2 h-10 w-10 text-muted-foreground" />
                    <CardTitle as="h2" className="text-2xl">
                      {allDone ? 'Your queue is complete' : 'PR complete'}
                    </CardTitle>
                    <CardDescription>
                      {allDone
                        ? 'You’ve labeled all comments and completed the missed-item passes.'
                        : `You’ve finished ${activePr.repo} #${activePr.number}.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3 rounded-lg bg-muted/50 p-4 text-center">
                      {(['good', 'bad', 'skip', 'missed'] as const).map((label) => (
                        <div key={label}>
                          <p className="text-2xl font-bold">
                            {session.labels.filter((item) => item.label === label).length}
                          </p>
                          <p className="mt-1 text-sm capitalize text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Export your sample labels with their original comments and hunks. No training
                      is started.
                    </p>
                  </CardContent>
                  <CardFooter className="flex-wrap justify-center gap-3">
                    {!allDone && (
                      <Button
                        onClick={() => {
                          const next = eligible.find((pr) => !session.completed.includes(pr.id));
                          if (next) {
                            setSearchParams({}, { replace: true });
                            openPR(next, 'all');
                          }
                        }}
                        className="gap-2"
                      >
                        Next PR
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" onClick={exportLabels} className="gap-2">
                      <Download className="h-4 w-4" />
                      Download sample JSONL
                    </Button>
                    <Button variant="ghost" onClick={() => setView('queue')}>
                      Back to your queue
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      {announcement && (
        <Alert role="note">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Demo progress</AlertTitle>
          <AlertDescription>{announcement}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
