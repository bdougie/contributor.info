/** Local-only QA launcher. Never imported by the application or Netlify bundle. */
import { spawn, execFileSync } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Session } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import reviewLabelsHandler from '../../netlify/functions/api-review-labels';
import { DEMO_PRS, type DemoReviewer } from '../../src/components/features/review-labels/demo-data';
import type { ReviewPR } from '../../src/types/review-labels';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateDir = resolve(root, '.review-labels-qa');
const uiPort = 5175;
const apiPort = 8891;
const uiOrigin = `http://localhost:${uiPort}`;
const apiOrigin = `http://localhost:${apiPort}`;
const cliPackage = 'supabase@2.117.0';
const excluded =
  'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';
type AccountKey = 'owner' | 'matt' | 'john';
interface Account {
  userId: string;
  appId: string;
  githubId: string;
  login: string;
  email: string;
  password: string;
}
interface SeedState {
  accounts: Record<AccountKey, Account>;
  workspaceId: string;
  repositoryIds: Record<string, string>;
}
interface LocalStatus {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  DB_URL: string;
}

async function cli(args: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn('npx', ['--yes', cliPackage, ...args, '--workdir', stateDir], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', fail);
    child.on('close', (code) => {
      if (code === 0) {
        done(stdout);
        return;
      }
      void writeFile(resolve(stateDir, 'startup.log'), stderr + '\n' + stdout, {
        mode: 0o600,
      }).then(() =>
        fail(new Error('Supabase setup failed. Details are in .review-labels-qa/startup.log.'))
      );
    });
  });
}
async function ensurePortFree(port: number) {
  await new Promise<void>((done, fail) => {
    const server = createTcpServer();
    server.once('error', () =>
      fail(
        new Error(`Port ${port} is in use. Close the previous QA runner before starting another.`)
      )
    );
    server.listen(port, '127.0.0.1', () => server.close(() => done()));
  });
}
function assertLocal(status: LocalStatus) {
  for (const [value, port] of [
    [status.API_URL, '54421'],
    [status.DB_URL, '54422'],
  ]) {
    const url = new URL(value);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== port)
      throw new Error('Refusing QA setup: database must be the isolated local project.');
  }
}
async function sql(status: LocalStatus, query: string) {
  assertLocal(status);
  const dbUrl = new URL(status.DB_URL);
  await new Promise<void>((done, fail) => {
    const child = spawn(
      'psql',
      [
        '-X',
        '-h',
        dbUrl.hostname,
        '-p',
        dbUrl.port,
        '-U',
        decodeURIComponent(dbUrl.username),
        '-d',
        dbUrl.pathname.slice(1),
        '-v',
        'ON_ERROR_STOP=1',
      ],
      {
        env: { ...process.env, PGPASSWORD: decodeURIComponent(dbUrl.password) },
        stdio: ['pipe', 'ignore', 'pipe'],
      }
    );
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`Local QA SQL failed: ${stderr}`))
    );
    child.stdin.end(query);
  });
}
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

await mkdir(resolve(stateDir, 'supabase/migrations'), { recursive: true, mode: 0o700 });
if (process.argv.includes('--stop')) {
  await cli(['stop']);
  console.log('Local QA database stopped.');
  process.exit(0);
}
await ensurePortFree(uiPort);
await ensurePortFree(apiPort);
if (process.argv.includes('--reset')) {
  await cli(['stop', '--no-backup']);
  await rm(resolve(stateDir, 'seed.json'), { force: true });
}
const schemaFiles = [
  [resolve(root, 'scripts/review-labels/schema.sql'), '20260907000000_qa_contracts.sql'],
  [
    resolve(root, 'supabase/migrations/20260907220000_review_labels.sql'),
    '20260907220000_review_labels.sql',
  ],
];
await copyFile(
  resolve(root, 'scripts/review-labels/supabase.toml'),
  resolve(stateDir, 'supabase/config.toml')
);
for (const [source, name] of schemaFiles)
  await copyFile(source, resolve(stateDir, 'supabase/migrations', name));
console.log('Starting isolated Supabase QA services. The first run downloads Docker images.');
await cli(['start', '--exclude', excluded]);
await cli(['migration', 'up', '--local']);
const status: LocalStatus = JSON.parse(await cli(['status', '--output', 'json']));
assertLocal(status);

// Override hosted settings before creating the API or Vite. Never load .env into
// this server process, and never put a service key or GitHub token in VITE_*.
process.env.SUPABASE_URL = status.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
process.env.VITE_SUPABASE_URL = status.API_URL;
process.env.VITE_SUPABASE_ANON_KEY = status.ANON_KEY;
process.env.VITE_REVIEW_LABEL_QA = 'true';
process.env.VITE_POSTHOG_KEY = '';
process.env.VITE_SENTRY_DSN = '';
process.env.DEV_API_TARGET = apiOrigin;
if (!process.env.GITHUB_TOKEN) {
  try {
    process.env.GITHUB_TOKEN = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error(
      'Run gh auth login or supply GITHUB_TOKEN to resolve public GitHub accounts for QA.'
    );
  }
}
const db = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let state: SeedState;
try {
  state = JSON.parse(await readFile(resolve(stateDir, 'seed.json'), 'utf8'));
} catch {
  state = {
    accounts: {} as Record<AccountKey, Account>,
    workspaceId: randomUUID(),
    repositoryIds: { tapes: randomUUID(), tapesctl: randomUUID() },
  };
}
const usersResult = await db.auth.admin.listUsers();
if (usersResult.error) throw usersResult.error;
const existingUsers = usersResult.data.users;
for (const [key, login] of Object.entries({ owner: 'bdougie', matt: 'yeazelm', john: 'jpmcb' }) as [
  AccountKey,
  string,
][]) {
  if (state.accounts[key]) continue;
  const response = await fetch(`https://api.github.com/users/${login}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GitHub account lookup failed. Check gh auth status.');
  const person = (await response.json()) as { id: number; login: string; avatar_url: string };
  const email = `${key}@review-labels.local`,
    password = randomBytes(24).toString('base64url');
  const attributes = {
    password,
    email_confirm: true,
    app_metadata: { provider: 'github', providers: ['email', 'github'] },
    user_metadata: { user_name: login, preferred_username: login, avatar_url: person.avatar_url },
  };
  const existing = existingUsers.find((user) => user.email === email);
  const userResult = existing
    ? await db.auth.admin.updateUserById(existing.id, attributes)
    : await db.auth.admin.createUser({ email, ...attributes });
  if (userResult.error) throw userResult.error;
  const user = userResult.data.user;
  if (!user) throw new Error('Local test account could not be created');
  const appId = randomUUID();
  await sql(
    status,
    `INSERT INTO auth.identities(user_id,provider,provider_id,identity_data,created_at,updated_at,last_sign_in_at) VALUES (${literal(user.id)},'github',${literal(String(person.id))},${literal(JSON.stringify({ sub: String(person.id), user_name: person.login, provider_id: String(person.id) }))}::jsonb,now(),now(),now()) ON CONFLICT(provider_id,provider) DO NOTHING;`
  );
  checked(
    await db.from('app_users').upsert(
      {
        id: appId,
        auth_user_id: user.id,
        github_id: person.id,
        github_username: person.login,
        email,
        display_name: `${key} (local QA)`,
        avatar_url: person.avatar_url,
      },
      { onConflict: 'auth_user_id' }
    )
  );
  state.accounts[key] = {
    userId: user.id,
    appId,
    githubId: String(person.id),
    login: person.login,
    email,
    password,
  };
}
await sql(
  status,
  `UPDATE auth.identities SET created_at=coalesce(created_at,now()),updated_at=coalesce(updated_at,now()),last_sign_in_at=coalesce(last_sign_in_at,now()) WHERE provider='github' AND user_id IN (${Object.values(
    state.accounts
  )
    .map((account) => literal(account.userId))
    .join(',')});`
);
checked(
  await db.from('workspaces').upsert({
    id: state.workspaceId,
    name: 'Paper Compute · Local QA',
    slug: 'paper-compute-qa',
    owner_id: state.accounts.owner.appId,
    tier: 'team',
  })
);
for (const [name, id] of Object.entries(state.repositoryIds)) {
  checked(
    await db.from('repositories').upsert({
      id,
      full_name: `papercomputeco/${name}`,
      name,
      owner: 'papercomputeco',
      is_private: false,
      language: name === 'tapes' ? 'Go' : 'Rust',
    })
  );
  checked(
    await db.from('workspace_repositories').upsert(
      {
        workspace_id: state.workspaceId,
        repository_id: id,
        added_by: state.accounts.owner.appId,
      },
      { onConflict: 'workspace_id,repository_id' }
    )
  );
}
await writeFile(resolve(stateDir, 'seed.json'), JSON.stringify(state), { mode: 0o600 });

async function seedAcceptedEnrollment(enrollmentId: string) {
  const enrollment = checked(
    await db
      .from('review_label_enrollments')
      .select('id,reviewer_login,campaign_id')
      .eq('id', enrollmentId)
      .maybeSingle()
  );
  if (!enrollment) return;
  const collection = checked(
    await db
      .from('review_label_campaigns')
      .select('repository_ids')
      .eq('id', enrollment.campaign_id)
      .maybeSingle()
  );
  if (!collection) return;
  for (const sample of DEMO_PRS.filter((pr) =>
    pr.participants.includes(enrollment.reviewer_login as DemoReviewer)
  )) {
    const repositoryId = state.repositoryIds[sample.repo];
    if (!collection.repository_ids.includes(repositoryId)) continue;
    const payload: Omit<ReviewPR, 'id'> = {
      repo: `papercomputeco/${sample.repo}`,
      number: sample.number,
      title: sample.title,
      author: sample.author,
      url: `https://github.com/papercomputeco/${sample.repo}`,
      closedAt: '2026-09-03T12:00:00Z',
      headSha: 'local-qa-sample',
      participation: sample.participation[enrollment.reviewer_login as DemoReviewer],
      hunks: sample.hunks,
      unavailableFiles: [],
      comments: sample.comments.map((comment) => ({
        id: comment.id,
        author: comment.author,
        authorId:
          Object.values(state.accounts).find((a) => a.login === comment.author)?.githubId || '0',
        isBot: comment.author.includes('[bot]'),
        body: comment.body,
        url: `https://github.com/papercomputeco/${sample.repo}`,
        hunkId: comment.hunkId,
        commitId: 'local-qa-sample',
        originalLine: sample.hunks.find((h) => h.id === comment.hunkId)?.startLine || null,
        replies: comment.replies.map((reply) => ({
          ...reply,
          time: '2026-09-03T12:00:00Z',
          url: `https://github.com/papercomputeco/${sample.repo}`,
        })),
        resolved: comment.resolved,
        outdated: false,
        laterApprovals: comment.laterApproval
          ? [
              {
                ...comment.laterApproval,
                time: '2026-09-03T13:00:00Z',
                body: '',
                url: `https://github.com/papercomputeco/${sample.repo}`,
              },
            ]
          : [],
      })),
    };
    checked(
      await db.from('review_label_prs').upsert(
        {
          enrollment_id: enrollmentId,
          repository_id: repositoryId,
          pr_number: sample.number,
          payload,
        },
        { onConflict: 'enrollment_id,repository_id,pr_number', ignoreDuplicates: true }
      )
    );
  }
  checked(
    await db.from('review_label_enrollments').update({ scan_done: true }).eq('id', enrollmentId)
  );
}

const server = createHttpServer(async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (
      !['localhost', '127.0.0.1'].includes((req.headers.host || '').split(':')[0]) ||
      (origin && ![uiOrigin, apiOrigin].includes(origin))
    ) {
      res.writeHead(403).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
      if (chunks.reduce((sum, c) => sum + c.length, 0) > 8192) {
        res.writeHead(413).end();
        return;
      }
    }
    const body = Buffer.concat(chunks).toString();
    const input = body ? JSON.parse(body) : {};
    let response: Response;
    if (req.url === '/.netlify/functions/review-labels-qa' && req.method === 'POST') {
      const key = input.account as AccountKey;
      if (!Object.hasOwn(state.accounts, key)) throw new Error('Choose Owner, Matt, or John');
      const auth = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const account = state.accounts[key];
      const result = await auth.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (result.error) throw result.error;
      response = Response.json({ session: result.data.session satisfies Session | null });
    } else if (req.url === '/.netlify/functions/api-review-labels') {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (typeof value === 'string') headers.set(key, value);
      response = await reviewLabelsHandler(
        new Request(apiOrigin + req.url, { method: req.method, headers, ...(body ? { body } : {}) })
      );
      if (response.ok && input.action === 'accept') {
        const result = (await response.clone().json()) as { enrollmentId: string };
        await seedAcceptedEnrollment(result.enrollmentId);
      }
      if (response.ok && input.action === 'export') {
        const result = (await response.json()) as { labels: object[]; revocations: object[] };
        response = Response.json({
          ...result,
          labels: result.labels.map((label) => ({ ...label, demo: true, qa: true })),
        });
      }
    } else {
      response = Response.json(
        { error: 'This QA runner serves review labels only' },
        { status: 404 }
      );
    }
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
      'cache-control': 'no-store',
    });
    res.end(await response.text());
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Local QA request failed' })
    );
  }
});
await new Promise<void>((done, fail) => {
  server.once('error', fail);
  server.listen(apiPort, '127.0.0.1', done);
});
const vite = await createViteServer({
  root,
  server: { host: '127.0.0.1', port: uiPort, strictPort: true },
  mode: 'review-labels-qa',
});
await vite.listen();
console.log('Local QA ready: %s/review-labels?source=human', uiOrigin);
console.log(
  'Use the Local QA account chooser: Owner → create link; Matt or John → accept and label.'
);
console.log('Sample PRs; real local Auth/API/database. Exports are marked demo:true and qa:true.');
console.log(
  'Ctrl-C stops the UI/API. Data persists. npm run qa:review-labels:stop stops the database.'
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void vite.close().then(() => server.close(() => process.exit(0)));
  });
