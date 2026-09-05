#!/usr/bin/env bash
# Exercise inbox RLS and state transitions in a disposable, Unix-socket-only PostgreSQL.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d /tmp/work-inbox-pg.XXXXXX)"
cleanup() {
  pg_ctl -D "$tmp/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
initdb -D "$tmp/data" -A trust --no-locale >/dev/null
pg_ctl -D "$tmp/data" -o "-k $tmp -c listen_addresses='' -p 55491" -l "$tmp/server.log" -w start >/dev/null
psql -X -h "$tmp" -p 55491 -d postgres -v ON_ERROR_STOP=1 \
  -f "$root/supabase/tests/fixtures/work-inbox-schema.sql" \
  -f "$root/supabase/migrations/20260905210000_workspace_work_inbox.sql" \
  -f "$root/supabase/tests/workspace-work-inbox.test.sql"
