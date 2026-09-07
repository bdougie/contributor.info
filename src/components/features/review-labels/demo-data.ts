/** Synthetic review fixtures. These are not comments from real pull requests. */
export type DemoReviewer = 'yeazelm' | 'jpmcb';
export type Decision = 'good' | 'bad' | 'skip';

export interface DemoHunk {
  id: string;
  path: string;
  language: 'Go' | 'Rust';
  startLine: number;
  diff: string;
}

export interface DemoComment {
  id: string;
  author: string;
  body: string;
  hunkId: string;
  replies: { author: string; body: string; time: string }[];
  resolved: boolean;
  laterApproval?: { author: string; time: string; body: string };
}

export interface DemoPR {
  id: string;
  repo: 'tapes' | 'tapesctl';
  number: number;
  title: string;
  author: DemoReviewer;
  date: string;
  participants: DemoReviewer[];
  participation: Record<DemoReviewer, string>;
  hunks: DemoHunk[];
  comments: DemoComment[];
}

export const REVIEWERS: Record<DemoReviewer, { name: string; initials: string }> = {
  yeazelm: { name: 'Matt', initials: 'MY' },
  jpmcb: { name: 'John', initials: 'JC' },
};

export const DEMO_PRS: DemoPR[] = [
  {
    id: 'demo-tapes-248',
    repo: 'tapes',
    number: 248,
    title: 'Close the recorder without dropping pending writes',
    author: 'yeazelm',
    date: 'Sep 3, 2026',
    participants: ['yeazelm', 'jpmcb'],
    participation: { yeazelm: 'You authored this PR', jpmcb: 'You reviewed this PR' },
    hunks: [
      {
        id: 'close',
        path: 'pkg/recorder/recorder.go',
        language: 'Go',
        startLine: 84,
        diff: '@@ -84,3 +84,7 @@ func (r *Recorder) Close() error {\n     r.cancel()\n-    return r.writer.Close()\n+    if err := r.writer.Flush(context.Background()); err != nil {\n+        return err\n+    }\n+    r.wg.Wait()\n+    return r.writer.Close()\n }',
      },
      {
        id: 'stop',
        path: 'pkg/recorder/recorder.go',
        language: 'Go',
        startLine: 102,
        diff: '@@ -102,3 +102,4 @@ func (r *Recorder) Stop() {\n     r.cancel()\n+    close(r.done)\n     r.wg.Wait()\n }',
      },
    ],
    comments: [
      {
        id: 'demo-comment-1',
        author: 'greptile[bot]',
        hunkId: 'close',
        resolved: true,
        body: 'Calling cancel here may drop buffered events. Flush the writer before cancelling the context so that pending writes can finish.',
        replies: [
          {
            author: 'jpmcb',
            time: 'Sep 3 · 10:42 am',
            body: 'Flush uses a separate context and Close waits for the writer. Cancellation only stops the reader, so buffered events are still written.',
          },
        ],
        laterApproval: {
          author: 'jpmcb',
          time: 'Sep 3 · 11:08 am',
          body: 'Approved with no review body or inline comments.',
        },
      },
      {
        id: 'demo-comment-2',
        author: 'jpmcb',
        hunkId: 'stop',
        resolved: false,
        body: 'Stop can be called by both the signal handler and the deferred cleanup. The second close of done will panic. Can we guard this with sync.Once?',
        replies: [],
      },
    ],
  },
  {
    id: 'demo-tapesctl-36',
    repo: 'tapesctl',
    number: 36,
    title: 'Wait for the session before attaching the terminal',
    author: 'jpmcb',
    date: 'Sep 2, 2026',
    participants: ['yeazelm', 'jpmcb'],
    participation: { yeazelm: 'You reviewed this PR', jpmcb: 'You authored this PR' },
    hunks: [
      {
        id: 'wait',
        path: 'src/commands/attach.rs',
        language: 'Rust',
        startLine: 42,
        diff: '@@ -42,4 +42,8 @@ pub async fn attach(client: &Client, id: &str) -> Result<()> {\n     let session = client.session(id).await?;\n-    session.attach().await?;\n+    while !session.is_ready().await? {\n+        tokio::time::sleep(Duration::from_millis(250)).await;\n+    }\n+\n+    session.attach().await?;\n     Ok(())\n }',
      },
      {
        id: 'name',
        path: 'src/commands/attach.rs',
        language: 'Rust',
        startLine: 61,
        diff: '@@ -61,2 +61,3 @@ fn display_name(session: &Session) -> String {\n-    session.id.to_string()\n+    let name = session.name.clone();\n+    name.unwrap_or_else(|| session.id.to_string())\n }',
      },
    ],
    comments: [
      {
        id: 'demo-comment-3',
        author: 'yeazelm',
        hunkId: 'wait',
        resolved: false,
        body: 'This loop has no deadline. If the session never becomes ready, attach will wait forever. Wrap the readiness check in a timeout and return the session ID with the error.',
        replies: [],
      },
      {
        id: 'demo-comment-4',
        author: 'greptile[bot]',
        hunkId: 'name',
        resolved: true,
        body: 'Cloning the session name allocates on every call. Consider returning a borrowed string to avoid this allocation.',
        replies: [
          {
            author: 'jpmcb',
            time: 'Sep 2 · 2:16 pm',
            body: 'This runs once when we print the session header. An owned name keeps the display code independent of the session lifetime.',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-tapes-241',
    repo: 'tapes',
    number: 241,
    title: 'Read the flush interval from recorder configuration',
    author: 'yeazelm',
    date: 'Aug 29, 2026',
    participants: ['yeazelm'],
    participation: { yeazelm: 'You authored this PR', jpmcb: '' },
    hunks: [
      {
        id: 'interval',
        path: 'pkg/recorder/config.go',
        language: 'Go',
        startLine: 26,
        diff: '@@ -26,2 +26,3 @@ func newTicker(cfg Config) *time.Ticker {\n-    return time.NewTicker(time.Second)\n+    interval := time.Duration(cfg.FlushIntervalMs) * time.Millisecond\n+    return time.NewTicker(interval)\n }',
      },
    ],
    comments: [
      {
        id: 'demo-comment-5',
        author: 'greptile[bot]',
        hunkId: 'interval',
        resolved: false,
        body: 'A zero or negative flush interval will panic in time.NewTicker. Validate the configured value or use a positive default before constructing the ticker.',
        replies: [],
      },
    ],
  },
];

export interface DemoLabel {
  id: string;
  prId: string;
  hunkId: string;
  commentId: string | null;
  label: Decision | 'missed';
  note: string | null;
  timestamp: string;
}

export interface DemoSession {
  joined: boolean;
  consentAt: string | null;
  labels: DemoLabel[];
  completed: string[];
}

export function emptySession(): DemoSession {
  return { joined: false, consentAt: null, labels: [], completed: [] };
}

export function toDemoJSONL(reviewer: DemoReviewer, session: DemoSession): string {
  return session.labels
    .map((label) => {
      const pr = DEMO_PRS.find((item) => item.id === label.prId)!;
      const hunk = pr.hunks.find((item) => item.id === label.hunkId)!;
      const comment = pr.comments.find((item) => item.id === label.commentId);
      return JSON.stringify({
        schema_version: 1,
        demo: true,
        record_id: label.id,
        reviewer_login: reviewer,
        repo: `papercomputeco/${pr.repo}`,
        pr_number: pr.number,
        file_path: hunk.path,
        hunk: hunk.diff,
        source_commit: 'synthetic-demo-commit',
        comment: comment ? { id: comment.id, author: comment.author, body: comment.body } : null,
        pushback: comment
          ? {
              replies: comment.replies,
              resolved: comment.resolved,
              later_approval: comment.laterApproval ?? null,
              change_at_resolution: 'unknown',
            }
          : null,
        label: label.label,
        note: label.note,
        labeled_at: label.timestamp,
        consent: { simulated: true, accepted_at: session.consentAt, version: 1 },
      });
    })
    .join('\n');
}
