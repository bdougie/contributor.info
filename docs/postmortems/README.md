# Incident Postmortems and Retrospectives

This folder contains detailed postmortem analyses of production incidents, outages, and critical bugs.

## Contents

### 2025 Incidents

#### January 2025
- **[2025-01-09-inngest-step-isolation-bug.md](./2025-01-09-inngest-step-isolation-bug.md)** - 13+ hour complete failure of embeddings generation due to missing OpenAI API key in production
- **[2025-01-type-checking-gaps.md](./2025-01-type-checking-gaps.md)** - Type checking issues discovered in production

#### October 2025
- **[2025-10-09-bot-contributor-sync-failures.md](./2025-10-09-bot-contributor-sync-failures.md)** - Bot contributor synchronization failures
- **[2025-10-09-embeddings-complete-resolution.md](./2025-10-09-embeddings-complete-resolution.md)** - Complete resolution of embeddings system issues
- **[2025-10-09-inngest-sync-field-name-fixes.md](./2025-10-09-inngest-sync-field-name-fixes.md)** - Field name mismatches in Inngest sync
- **[2025-10-09-missing-pr-issue-embeddings.md](./2025-10-09-missing-pr-issue-embeddings.md)** - Missing embeddings for PRs and issues
- **[2025-10-10-respond-tracking-table-mismatch.md](./2025-10-10-respond-tracking-table-mismatch.md)** - Database table mismatch in respond tracking
- **[2025-10-11-inngest-event-data-structure-mismatch.md](./2025-10-11-inngest-event-data-structure-mismatch.md)** - Event data structure inconsistencies
- **[2025-10-23-subscription-activation-failures.md](./2025-10-23-subscription-activation-failures.md)** - Subscription system activation issues

#### September 2025
- **[2025-09-27-missing-commits-table.md](./2025-09-27-missing-commits-table.md)** - Missing database table for commits
- **[2025-09-28-repository-tracking-failure.md](./2025-09-28-repository-tracking-failure.md)** - Repository tracking system failures
- **[2025-09-contributor-rankings-failure.md](./2025-09-contributor-rankings-failure.md)** - Contributor rankings calculation failures
- **[2025-09-workspace-data-display-rls-fix.md](./2025-09-workspace-data-display-rls-fix.md)** - RLS policy preventing workspace data display
- **[406-error-resolution.md](./406-error-resolution.md)** - HTTP 406 error resolution

### Legacy Incidents
- **[auth-database-error-resolution.md](./auth-database-error-resolution.md)** - Authentication database error fixes
- **[data-consistency-audit-report.md](./data-consistency-audit-report.md)** - System-wide data consistency audit
- **[data-consistency-fix-summary.md](./data-consistency-fix-summary.md)** - Data consistency issue resolutions
- **[fix-auth-error-implementation.md](./fix-auth-error-implementation.md)** - Authentication error fix implementation
- **[github-sync-debug-summary.md](./github-sync-debug-summary.md)** - GitHub sync debugging summary
- **[mobile-fixes-summary.md](./mobile-fixes-summary.md)** - Mobile platform bug fixes
- **[production-deployment-2025-06-22.md](./production-deployment-2025-06-22.md)** - Production deployment issues
- **[storybook-test-fix.md](./storybook-test-fix.md)** - Storybook testing issues

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
