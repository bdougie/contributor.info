# Incident Postmortems and Retrospectives

This folder contains detailed postmortem analyses of production incidents, outages, and critical bugs.

## Contents

Files are named `YYYY-MM[-DD]-slug.md`. Two older files without a date prefix are kept under their original names.

### 2025

- [2025-01-12-auth-database-error-resolution.md](./2025-01-12-auth-database-error-resolution.md) - "Database error saving new user" on GitHub sign-up; resolved by removing the `auth.users` trigger
- [2025-01-12-github-auth-database-error-fix.md](./2025-01-12-github-auth-database-error-fix.md) - Earlier investigation of the same sign-up failure
- [2025-01-type-checking-gaps.md](./2025-01-type-checking-gaps.md) - Type checking gaps in edge functions
- [2025-06-22-production-deployment.md](./2025-06-22-production-deployment.md) - White screen and module loading failures after a production deploy
- [2025-06-data-consistency-fix.md](./2025-06-data-consistency-fix.md) - Contributor role and bot classification consistency fix
- [2025-08-21-bundle-splitting-attempt.md](./2025-08-21-bundle-splitting-attempt.md) - React initialization failures when splitting vendor bundles
- [2025-09-27-missing-commits-table.md](./2025-09-27-missing-commits-table.md) - Missing database table for commits
- [2025-09-28-repository-tracking-failure.md](./2025-09-28-repository-tracking-failure.md) - Repository tracking system failures
- [2025-09-contributor-rankings-failure.md](./2025-09-contributor-rankings-failure.md) - Contributor rankings calculation failures
- [2025-09-workspace-data-display-rls-fix.md](./2025-09-workspace-data-display-rls-fix.md) - RLS policy preventing workspace data display
- [2025-10-08-inngest-embeddings-signature-failures.md](./2025-10-08-inngest-embeddings-signature-failures.md) - Embeddings scripts failing with missing Inngest signature
- [2025-10-09-bot-contributor-sync-failures.md](./2025-10-09-bot-contributor-sync-failures.md) - Bot contributor synchronization failures
- [2025-10-09-embeddings-complete-resolution.md](./2025-10-09-embeddings-complete-resolution.md) - Full resolution of the October embeddings outage (missing OpenAI key, upsert syntax, step isolation)
- [2025-10-09-inngest-sync-field-name-fixes.md](./2025-10-09-inngest-sync-field-name-fixes.md) - Field name mismatches in Inngest sync
- [2025-10-09-missing-pr-issue-embeddings.md](./2025-10-09-missing-pr-issue-embeddings.md) - Missing embeddings for PRs and issues
- [2025-10-10-respond-tracking-table-mismatch.md](./2025-10-10-respond-tracking-table-mismatch.md) - Database table mismatch in respond tracking
- [2025-10-11-inngest-event-data-structure-mismatch.md](./2025-10-11-inngest-event-data-structure-mismatch.md) - Event data structure inconsistencies
- [2025-10-23-subscription-activation-failures.md](./2025-10-23-subscription-activation-failures.md) - Subscription activation failures
- [lcp-improvements-dec-2025.md](./lcp-improvements-dec-2025.md) - December 2025 LCP improvement work and what regressed

### Undated

- [406-error-resolution.md](./406-error-resolution.md) - HTTP 406 errors from `.single()` on empty results; referenced by the ESLint config

## Purpose

Postmortems serve to:
- Document what went wrong and why
- Identify root causes of incidents
- Track corrective actions
- Share learnings across the team
- Prevent similar incidents in the future
- Build institutional knowledge

## Postmortem Structure

Each postmortem should include:

1. **Issue Summary** - Duration, impact, severity, resolution
2. **Timeline** - Chronological sequence of events
3. **Root Causes Identified** - What caused the incident
4. **Final Resolution** - How the issue was fixed
5. **Discovery Process** - How the root cause was found
6. **Why It Took So Long to Find** - What delayed resolution
7. **Prevention Measures** - How to avoid future occurrences
8. **Lessons Learned** - Key takeaways
9. **Action Items** - Follow-up tasks
10. **Impact Analysis** - Time, scope, and cost of the incident

## Severity Levels

- **Critical** - Complete feature failure, data loss, or security breach
- **High** - Major functionality impaired, affecting many users
- **Medium** - Significant bug affecting some users or workflows
- **Low** - Minor issue with limited impact

## Best Practices

1. **Blameless** - Focus on systems and processes, not individuals
2. **Timely** - Write within 48 hours while details are fresh
3. **Detailed** - Include timeline, root causes, and prevention
4. **Actionable** - Document clear follow-up actions
5. **Learning-focused** - Extract lessons for the team

## Common Root Causes

Based on our postmortems:
- Configuration issues (missing environment variables)
- Type safety gaps (any types, unknown validation)
- Integration failures (API keys, third-party services)
- Database issues (RLS policies, schema mismatches)
- Deployment problems (secrets not set in production)

## Prevention Strategies

Implemented based on postmortems:
- Strict no-any TypeScript policy
- Zod runtime validation
- Environment variable validation at startup
- RLS policy monitoring
- Deployment checklists
- Integration testing

## Related Documentation

- [Solutions](../solutions/) - Specific technical solutions
- [Fixes](../fixes/) - Bug fix documentation
- [Migrations](../migrations/) - System migration documentation
- [Operations](../operations/) - Operational procedures
