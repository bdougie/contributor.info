import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  Github,
  Lock,
  Plus,
  Shield,
  Users,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { REVIEW_CONSENT_TEXT } from '@/types/review-labels';
import { REVIEWERS, type DemoComment, type DemoHunk, type DemoReviewer } from './demo-data';

export function AuthorAvatar({ login, small = false }: { login: string; small?: boolean }) {
  const bot = login.includes('[bot]');
  const person = REVIEWERS[login as DemoReviewer];
  return (
    <Avatar className={cn('h-10 w-10', small && 'h-8 w-8')}>
      {!bot && (
        <AvatarImage src={`https://avatars.githubusercontent.com/${login}?s=80`} alt={login} />
      )}
      <AvatarFallback className="text-xs">
        {bot ? <Bot className="h-4 w-4" /> : person?.initials || login.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function CommentAuthor({
  comment,
  reviewer,
}: {
  comment: DemoComment;
  reviewer: DemoReviewer;
}) {
  const bot = comment.author.includes('[bot]');
  let description = 'Human review';
  if (bot) description = 'Bot review';
  else if (comment.author === reviewer) description = 'Your review';
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <AuthorAvatar login={comment.author} />
      <div>
        <p className="text-sm font-medium">
          {REVIEWERS[comment.author as DemoReviewer]?.name || 'Greptile'}
        </p>
        <p className="text-xs text-muted-foreground">@{comment.author}</p>
      </div>
      <Badge variant="secondary" className="ml-auto font-normal">
        {description}
      </Badge>
    </div>
  );
}

export function DiffHunk({
  hunk,
  select,
  selected = false,
}: {
  hunk: DemoHunk;
  select?: () => void;
  selected?: boolean;
}) {
  let oldLine = hunk.startLine;
  let newLine = hunk.startLine;
  return (
    <Card
      className={cn('min-w-0 overflow-hidden', selected && 'border-primary')}
      aria-label={`Code hunk in ${hunk.path}`}
    >
      <CardHeader className="space-y-3 border-b bg-muted/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code className="break-all text-xs sm:text-sm">{hunk.path}</code>
          </div>
          {select ? (
            <Button
              size="sm"
              variant={selected ? 'default' : 'outline'}
              onClick={select}
              className="gap-2"
            >
              {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {selected ? 'Selected hunk' : 'Mark missed here'}
            </Button>
          ) : (
            <Badge variant="outline">{hunk.language}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0" tabIndex={0} aria-label="Scrollable code diff">
        <div className="w-max min-w-full py-2 font-mono text-xs leading-6">
          {hunk.diff.split('\n').map((line, index) => {
            if (line.startsWith('@@'))
              return (
                <div className="bg-muted/50 px-4 py-2 text-muted-foreground" key={index}>
                  {line}
                </div>
              );
            const added = line.startsWith('+');
            const removed = line.startsWith('-');
            const oldNumber = added ? '' : oldLine++;
            const newNumber = removed ? '' : newLine++;
            return (
              <div
                key={index}
                className={cn(
                  'flex pr-4',
                  added && 'bg-green-500/10 text-green-700 dark:text-green-300',
                  removed && 'bg-red-500/10 text-red-700 dark:text-red-300'
                )}
              >
                <span className="w-9 shrink-0 select-none pr-2 text-right text-muted-foreground">
                  {oldNumber}
                </span>
                <span className="w-9 shrink-0 select-none pr-2 text-right text-muted-foreground">
                  {newNumber}
                </span>
                <span className="w-6 shrink-0 select-none text-center">{line[0]}</span>
                <code className="whitespace-pre">{line.slice(1)}</code>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
        <GitBranch className="h-3 w-3" />
        Original review hunk · sample source
      </CardFooter>
    </Card>
  );
}

export function ConsentNotice() {
  return (
    <Alert role="note">
      <Shield className="h-4 w-4" />
      <AlertTitle>Your labels, your consent</AlertTitle>
      <AlertDescription>
        {REVIEW_CONSENT_TEXT} Consent is simulated in this prototype.
      </AlertDescription>
    </Alert>
  );
}

export function Invitation({
  reviewer,
  signedIn,
  onSignIn,
  onJoin,
}: {
  reviewer: DemoReviewer;
  signedIn: boolean;
  onSignIn: () => void;
  onJoin: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <Badge variant="secondary">Workspace invitation</Badge>
        </div>
        <CardTitle as="h2" className="text-2xl">
          Join Paper Compute
        </CardTitle>
        <CardDescription>
          Brian invited you to join the workspace and label reviews on PRs you participated in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <AuthorAvatar login={reviewer} />
          <div>
            <p className="font-medium">
              {REVIEWERS[reviewer].name}{' '}
              <span className="text-sm font-normal text-muted-foreground">@{reviewer}</span>
            </p>
            <p className="text-sm text-muted-foreground">Invited as a contributor</p>
          </div>
          {signedIn && <CheckCircle2 className="ml-auto h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Selected repositories</h3>
          {['tapes', 'tapesctl'].map((repo) => (
            <div key={repo} className="flex items-center gap-2 text-sm">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span>papercomputeco/{repo}</span>
              <Badge variant="outline" className="ml-auto">
                Public
              </Badge>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          paper, paper-forest, and cloud can follow after private repository access is connected.
        </p>
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Review feedback from people and bots</p>
          <p className="mt-1 text-muted-foreground">
            Label comments by Matt, John, and Greptile as good, bad, or skip. Add a one-line note
            for anything the review missed.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        {signedIn ? (
          <Button onClick={onJoin} className="gap-2">
            Join workspace <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onSignIn} className="gap-2">
            <Github className="h-4 w-4" />
            Continue with GitHub
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {signedIn
            ? `Demo signed in as @${reviewer}. Joining does not opt you in to training.`
            : 'Demo sign-in. No GitHub account is connected.'}
        </p>
      </CardFooter>
    </Card>
  );
}

export function ReviewCommentCard({
  comment,
  reviewer,
}: {
  comment: DemoComment;
  reviewer: DemoReviewer;
}) {
  return (
    <Card className="min-w-0" data-testid="review-comment">
      <CardHeader>
        <CardTitle as="h2" className="text-base">
          Review comment
        </CardTitle>
        <CardDescription>
          Original comment text. Your label applies to this comment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CommentAuthor comment={comment} reviewer={reviewer} />
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Discussion and follow-up</h3>
            {comment.resolved && (
              <Badge variant="outline" className="gap-1 font-normal">
                <Check className="h-3 w-3" />
                Resolved
              </Badge>
            )}
          </div>
          {comment.replies.map((reply) => (
            <div className="flex items-start gap-3" key={reply.author + reply.time}>
              <AuthorAvatar login={reply.author} small />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <strong className="font-medium">{reply.author}</strong>
                  <span className="text-xs text-muted-foreground">{reply.time}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {reply.body}
                </p>
              </div>
            </div>
          ))}
          {comment.laterApproval && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-sm">
                <p>{comment.laterApproval.author} approved later</p>
                <p className="text-xs text-muted-foreground">{comment.laterApproval.time}</p>
                <p className="mt-1 text-muted-foreground">{comment.laterApproval.body}</p>
              </div>
            </div>
          )}
          {comment.replies.length === 0 && !comment.laterApproval && (
            <p className="text-sm text-muted-foreground">No follow-up in this sample.</p>
          )}
          {comment.resolved && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Changes at resolution are unknown. Resolution and approval are context, not labels.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
