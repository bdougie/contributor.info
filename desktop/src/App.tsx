import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

const SITE = 'https://contributor.info';

interface WorkspaceMetrics {
  time_range: string;
  total_prs: number;
  merged_prs: number;
  open_prs: number;
  draft_prs: number;
  avg_pr_merge_time_hours: number | null;
  pr_velocity: number | null;
  open_issues: number;
  issue_closure_rate: number | null;
  total_contributors: number;
  active_contributors: number;
  new_contributors: number;
  total_stars: number;
  stars_trend: number | null;
  prs_trend: number | null;
  contributors_trend: number | null;
  calculated_at: string | null;
  is_stale: boolean;
}

interface WorkspaceStatus {
  slug: string;
  name: string;
  state: string;
  metrics: WorkspaceMetrics | null;
}

interface Snapshot {
  workspaces: WorkspaceStatus[];
  signed_in_as: string | null;
  refreshed_at: number;
}

function Trend({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.5) return null;
  const up = value > 0;
  return (
    <span className={up ? 'trend up' : 'trend down'}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function Tile(props: { label: string; value: string; trend?: number | null }) {
  return (
    <div className="tile">
      <span className="tile-value">
        {props.value} <Trend value={props.trend ?? null} />
      </span>
      <span className="tile-label">{props.label}</span>
    </div>
  );
}

const STATE_HINT: Record<string, string> = {
  not_found: 'not found — sign in if this is a private workspace',
  no_metrics: "couldn't load metrics",
  unconfigured: 'Supabase anon key missing — see desktop/README.md',
  unreachable: 'offline',
};

export default function App() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>('get_workspaces').then(setSlugs);
    invoke<Snapshot>('get_snapshot').then(setSnapshot);
    const unlistenSnapshot = listen<Snapshot>('snapshot', (e) => setSnapshot(e.payload));
    const unlistenLoginError = listen<string>('login-error', (e) => setAuthError(e.payload));
    return () => {
      unlistenSnapshot.then((fn) => fn());
      unlistenLoginError.then((fn) => fn());
    };
  }, []);

  const signIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await invoke<string>('login');
    } catch (e) {
      setAuthError(String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    await invoke('logout');
  };

  const save = async (next: string[]) => {
    setSlugs(next);
    await invoke('set_workspaces', { workspaces: next });
  };

  const addWorkspace = async () => {
    // Accept a bare slug, a `/i/{slug}` URL/path, or a value with stray
    // leading/trailing slashes, and reduce it to the bare slug the API and
    // `/i/{slug}` links expect. A leading slash here previously slipped through
    // and produced `/i//{slug}` links plus failed lookups.
    const slug = draft.trim().replace(/^.*\/i\//, '').replace(/^\/+|\/+$/g, '');
    if (!slug || slugs.includes(slug)) return;
    setDraft('');
    await save([...slugs, slug]);
  };

  const statusFor = (slug: string): WorkspaceStatus | undefined =>
    snapshot?.workspaces.find((w) => w.slug === slug);

  return (
    <main>
      <header>
        <h1>
          <img src={`${SITE}/favicon.svg`} alt="" width={22} height={22} /> contributor.info
          workspaces
        </h1>
        <div className="add">
          <input
            placeholder="workspace slug or /i/ URL"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWorkspace()}
          />
          <button onClick={addWorkspace}>Add</button>
          {snapshot?.signed_in_as ? (
            <span className="account">
              {snapshot.signed_in_as}
              <button className="ghost" onClick={signOut}>
                Sign out
              </button>
            </span>
          ) : (
            <button className="secondary" onClick={signIn} disabled={authBusy}>
              {authBusy ? 'Waiting for browser…' : 'Sign in with GitHub'}
            </button>
          )}
        </div>
      </header>

      {authError && <p className="auth-error">Sign-in failed: {authError}</p>}

      <section className="cards">
        {slugs.map((slug) => {
          const ws = statusFor(slug);
          const m = ws?.metrics ?? null;
          return (
            <article key={slug} className="card">
              <div className="card-head">
                <a onClick={() => openUrl(`${SITE}/i/${slug}`)}>{ws?.name ?? slug}</a>
                {m && <span className="badge">{m.time_range}</span>}
                <span className="spacer" />
                {ws && ws.state !== 'ready' && (
                  <span className="badge warn">{STATE_HINT[ws.state] ?? ws.state}</span>
                )}
                <button className="ghost" title="Remove" onClick={() => save(slugs.filter((s) => s !== slug))}>
                  ✕
                </button>
              </div>
              {m && (
                <div className="tiles">
                  <Tile label="open PRs" value={String(m.open_prs)} trend={m.prs_trend} />
                  <Tile label="merged" value={String(m.merged_prs)} />
                  <Tile
                    label="PRs / day"
                    value={(m.pr_velocity ?? 0).toFixed(1)}
                  />
                  <Tile
                    label="hrs to merge"
                    value={(m.avg_pr_merge_time_hours ?? 0).toFixed(0)}
                  />
                  <Tile
                    label="active contribs"
                    value={String(m.active_contributors)}
                    trend={m.contributors_trend}
                  />
                  <Tile label="new contribs" value={String(m.new_contributors)} />
                  <Tile label="open issues" value={String(m.open_issues)} />
                  <Tile
                    label="stars"
                    value={m.total_stars.toLocaleString()}
                    trend={m.stars_trend}
                  />
                </div>
              )}
              {m?.is_stale && <p className="stale">metrics cache is stale — refresh on the site</p>}
            </article>
          );
        })}
        {slugs.length === 0 && (
          <p className="empty">
            Add a workspace above (its slug from contributor.info/i/…) to see its team metrics
            here and in the tray menu.
          </p>
        )}
      </section>

      <footer>
        {snapshot?.refreshed_at
          ? `Refreshed ${new Date(snapshot.refreshed_at * 1000).toLocaleTimeString()}`
          : 'Waiting for first refresh…'}
        <button className="ghost" onClick={() => invoke('refresh_now')}>
          Refresh
        </button>
      </footer>
    </main>
  );
}
