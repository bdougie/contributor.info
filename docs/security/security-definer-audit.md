# SECURITY DEFINER audit — issue #1795

Triage of 69 distinct functions in `public` defined as `SECURITY DEFINER` with EXECUTE granted to `anon` and/or `authenticated`. The Supabase advisor counts each function twice (once per role), reporting 138 findings.

## search_path posture

| Status | Count | Risk |
|---|---|---|
| `search_path=""` (empty, hardened) | 15 | None |
| `search_path=public, pg_catalog, pg_temp` (explicit) | 21 | None |
| `search_path=public` (partial) | 8 | Low — user could shadow names from later schemas, but `pg_catalog` is implicit-first |
| `NULL` (no override) | 25 | **High** — caller's `search_path` wins, schema shadowing possible |

**25 vulnerable to search_path attacks.** All need `SET search_path = ''` (or explicit allowlist) regardless of what other action we take.

## Triage by bucket

Recommendations: **KEEP** (DEFINER required, harden), **INVOKER** (switch to SECURITY INVOKER), **REVOKE** (remove EXECUTE from anon/authenticated; service_role/admin only), **REVIEW** (needs body inspection).

### 01 — RLS helpers (4) → KEEP

Pure scalars derived from `auth.uid()` / workspace lookups, called from RLS policies. Need DEFINER to avoid recursion. All hardened.

| Function | Action |
|---|---|
| `rls_current_app_user_id` | KEEP |
| `rls_user_workspace_role` | KEEP |
| `rls_workspace_is_public` | KEEP |
| `rls_workspace_owner_id` | KEEP |

### 02 — Workspace permission helpers (6) → KEEP, harden 3

Used by RLS policies to gate workspace access. Must stay DEFINER. Three are missing search_path.

| Function | Action | Note |
|---|---|---|
| `check_workspace_permission` | KEEP | hardened |
| `get_workspace_role` | KEEP | hardened |
| `is_workspace_member` | KEEP | hardened |
| `is_workspace_admin_or_owner` | KEEP + harden | `SET search_path = ''` |
| `can_add_repository` | KEEP + harden | `SET search_path = ''` |
| `can_create_workspace` | KEEP + harden | `SET search_path = ''` |

### 03 — Workspace invitation RPCs (5) → KEEP, harden, REVIEW callers

Token-based invitation flows. DEFINER is required to bypass RLS on `workspace_members` for non-members. Verify token validation in body before signing off.

| Function | Action | Note |
|---|---|---|
| `accept_workspace_invitation` | KEEP + harden | move `search_path=public` → `''`, REVIEW token validation |
| `decline_workspace_invitation` | KEEP + harden | move `search_path=public` → `''` |
| `get_workspace_invitation_by_token` | KEEP + harden | move `search_path=public` → `''` |
| `add_owner_as_workspace_member` | KEEP + harden | NULL search_path, REVIEW (looks like trigger) |
| `trigger_workspace_invitation_email` | REVIEW | NULL search_path; if it sends email via `pg_net`, REVOKE from anon |

### 04 — Workspace stats / refresh (8) → split

Read-side aggregations should be INVOKER + RLS. Write-side refreshers should REVOKE (cron-only).

| Function | Action | Note |
|---|---|---|
| `get_user_workspace_count` | INVOKER candidate | pure read of own user; verify `auth.uid()` filter |
| `get_workspace_activity_velocity` | INVOKER candidate | NULL search_path; verify membership check |
| `get_workspace_event_metrics_aggregated` | INVOKER candidate | NULL search_path; verify membership check |
| `get_workspace_repository_event_summaries` | INVOKER candidate | NULL search_path; verify membership check |
| `refresh_all_workspace_preview_stats` | REVOKE | cron/service_role only |
| `refresh_workspace_preview_stats` | REVIEW | per-workspace; could stay DEFINER if member-callable |
| `sync_workspace_tracked_repositories` | REVOKE | trigger/cron only |
| `trigger_workspace_stats_refresh` | REVOKE | trigger only |

### 05 — Spam reports (8) → split

User-facing report submission must validate `auth.uid()`. Admin actions should REVOKE.

| Function | Action | Note |
|---|---|---|
| `check_spam_report_rate_limit` | KEEP | hardened, called pre-insert |
| `increment_spam_report_count` | KEEP | hardened, internal |
| `increment_reporter_counts` | KEEP | hardened, trigger-side |
| `update_reporter_stats` | KEEP | hardened, trigger-side |
| `auto_verify_spam_reports` | REVOKE | admin/cron action |
| `bulk_verify_spam_reports` | REVOKE | admin action |
| `manage_spam_reporter` | REVOKE | admin action |
| `verify_spam_report` | REVOKE | admin action |

### 06 — Repository metrics / trending (6) → INVOKER

All read-only against public repo data. No reason to need DEFINER.

| Function | Action | Note |
|---|---|---|
| `capture_repository_metrics` | REVIEW | writes — REVOKE if cron-only |
| `get_repository_contributor_counts` | INVOKER | NULL search_path |
| `get_repository_pr_counts` | INVOKER | NULL search_path |
| `get_trending_repositories` | INVOKER | NULL search_path |
| `get_trending_repositories_with_fallback` | INVOKER | NULL search_path |
| `get_trending_statistics` | INVOKER | NULL search_path |

### 07 — Confidence analytics (5) → INVOKER

Read-only summaries over public data. All have explicit search_path.

| Function | Action |
|---|---|
| `get_confidence_analytics_summary` | INVOKER |
| `get_confidence_analytics_summary_simple` | INVOKER |
| `get_repository_confidence_breakdown` | INVOKER |
| `get_repository_confidence_summary` | INVOKER |
| `get_repository_confidence_summary_simple` | INVOKER |

### 08 — User / auth (7) → split

| Function | Action | Note |
|---|---|---|
| `current_user_is_admin` | KEEP | hardened, used in RLS |
| `get_user_by_github_id` | INVOKER candidate | REVIEW — leaks across users? |
| `get_user_tier` | INVOKER candidate | NULL search_path; verify `auth.uid() = user_uuid` |
| `sync_user_to_app_users` | REVOKE | trigger-only |
| `log_auth_error` | KEEP | hardened, called from auth callback |
| `get_recent_auth_errors` | REVOKE | admin action |
| `resolve_auth_error` | REVOKE | admin action |

### 09 — Email / consent / GDPR (4) → KEEP, validate caller

All hardened. Each needs `auth.uid() = p_user_id` enforcement in body.

| Function | Action |
|---|---|
| `check_email_rate_limit` | KEEP, REVIEW caller validation |
| `log_gdpr_processing` | KEEP, REVIEW caller validation |
| `user_has_email_consent` | KEEP, REVIEW caller validation |
| `withdraw_email_consent` | KEEP, REVIEW caller validation |

### 10 — Admin (3) → REVOKE

Admin-only by name. Should not be callable by anon/authenticated.

| Function | Action |
|---|---|
| `check_user_slack_integration_limit` | REVIEW (might be user self-check) |
| `log_admin_action` | REVOKE |
| `override_contributor_role` | REVOKE |

### 11 — Billing (2) → REVOKE

Service-role only.

| Function | Action |
|---|---|
| `calculate_overage_charges` | REVOKE |
| `get_subscription_issues` | REVOKE |

### 12 — Background jobs / cleanup (9) → REVOKE

Cron / service_role only.

| Function | Action |
|---|---|
| `batch_capture_metrics` | REVOKE |
| `clean_expired_reviewer_cache` | REVOKE |
| `cleanup_old_github_activities` | REVOKE |
| `get_progressive_capture_metrics` | REVOKE |
| `get_stuck_job_summary` | REVOKE |
| `increment_embedding_job_progress` | REVOKE |
| `move_to_dead_letter_queue` | REVOKE |
| `purge_old_file_data` | REVOKE |
| `refresh_contribution_stats` | REVOKE |

### 13 — Triggers (2) → REVOKE

Should only fire as triggers; no caller-level EXECUTE needed.

| Function | Action |
|---|---|
| `enforce_respond_columns_issues` | REVOKE |
| `ensure_repository_id` | REVOKE |

## Summary by action

| Action | Count |
|---|---|
| KEEP (DEFINER required) | ~22 |
| INVOKER | ~14 |
| REVOKE EXECUTE from anon/authenticated | ~26 |
| REVIEW (body inspection needed) | ~7 |

## Rollout plan

Land as separate PRs to keep blast radius small:

1. **PR-A: search_path hardening** — add `SET search_path = ''` (or `public, pg_catalog, pg_temp` where collation matters) to all 25 NULL + 8 partial functions. Pure mitigation, no behavior change. Independent of action choice.
2. **PR-B: REVOKE bucket** — bucket 12 (jobs/cleanup), bucket 13 (triggers), and the safe REVOKE entries from buckets 05/08/10/11. Test: confirm `pg_cron`/service_role still works; UI doesn't call them.
3. **PR-C: INVOKER conversions** — buckets 06, 07, and read-only entries in 04 and 08. Add RLS to underlying tables if missing. Highest regression risk; gate on staging.
4. **PR-D: REVIEW resolution** — final ~7 functions after body inspection.

Re-run `get_advisors(security)` after each PR; expect ~2× function count drop (anon + authenticated).
