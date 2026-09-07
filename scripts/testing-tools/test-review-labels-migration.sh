#!/usr/bin/env bash
# Uses a disposable Unix-socket-only database. Never connects to a deployed project.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
review_test_tmp="$(mktemp -d /tmp/review-labels-pg.XXXXXX)"
cleanup() {
  pg_ctl -D "$review_test_tmp/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$review_test_tmp"
}
trap cleanup EXIT
initdb -D "$review_test_tmp/data" -A trust --no-locale >/dev/null
pg_ctl -D "$review_test_tmp/data" -o "-k $review_test_tmp -c listen_addresses='' -p 55492" -l "$review_test_tmp/server.log" -w start >/dev/null
psql -X -h "$review_test_tmp" -p 55492 -d postgres -v ON_ERROR_STOP=1 \
  -f "$root/supabase/tests/fixtures/review-labels-schema.sql" \
  -f "$root/supabase/migrations/20260907220000_review_labels.sql" \
  -f "$root/supabase/tests/review-labels.test.sql"
