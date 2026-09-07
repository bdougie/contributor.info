# Documentation

Internal technical documentation for contributor.info. Public user-facing docs live
in `mintlify-docs/` and are published at https://docs.contributor.info.

Start with [AGENTS.md](../AGENTS.md) for the project overview and
[CONTRIBUTING.md](../CONTRIBUTING.md) for the development workflow.

## Getting Started

- [Setup](./setup/) - Local development, Windows setup, database migrations, seed data, Polar and LLM setup
- [Supabase](./supabase/) - Dev setup, RLS policies, quick reference, workspace queries
- [Configuration](./configuration/) - Project configuration reference
- [Development](./development/) - Hooks, logging, pre-commit hooks, mocks, evals
- [Guides](./guides/) - Task-oriented how-tos

## Architecture and Data

- [Architecture](./architecture/) - Inngest functions, retry and backoff, state machines, schema validation
- [Data Fetching](./data-fetching/) - Database-first fetching, Inngest jobs, GitHub Actions backfills, throttling
- [Database](./database/) - RLS performance, policy patterns, workspace schema, trigger troubleshooting
- [Edge Functions](./edge-functions/) - Supabase edge function guides and secret management
- [Infrastructure](./infrastructure/) - Inngest on Supabase, Netlify, Fly.io webhooks, idempotency
- [Webhooks](./webhooks/) - GitHub webhook handling
- [API](./api/) - Internal API reference
- [Technical](./technical/) - Supabase query patterns, common errors, discovery architecture
- [Validation](./validation/) - No-any policy and Zod runtime validation
- [Design Patterns](./design-patterns/) and [Patterns](./patterns/) - Reusable UI and code patterns

## Features

- [Features](./features/) - Feature-level architecture and behavior docs
- [Implementations](./implementations/) - Implementation notes for shipped features with no other home
- [Feature Flags](./feature-flags/) - Feature flag system
- [GitHub App](./github-app/) - GitHub App setup, webhooks, and troubleshooting
- [Integrations](./integrations/) - Slack and other third-party integrations
- [Workspace](./workspace/) - Workspace-specific notes
- [Product Requirements](./product-requirements/) - PRDs and design specs
- [User Experience](./user-experience/) - Invisible data loading, feature template, implementation checklist
- [UX Improvements](./ux-improvements/) - UX improvement notes
- [User Guide](./user-guide/) - Desktop app and end-user guides

## Quality and Operations

- [Testing](./testing/) - Bulletproof testing guidelines, e2e philosophy, load testing, release process
- [Performance](./performance/) - Web vitals monitoring, code splitting, lazy loading, caching
- [Analytics](./analytics/) - PostHog strategy, funnels, and events
- [Security](./security/) - Security guidelines, CSP, RLS audits
- [Privacy](./privacy/) - Privacy policy and data handling
- [Alerting](./alerting/) - Sentry alert configuration
- [Error Handling](./error-handling/) - Error logging with Sentry
- [Operations](./operations/) - Operational procedures
- [Debugging](./debugging/) - Debugging guides
- [Troubleshooting](./troubleshooting/) - Common issues and fixes
- [Fixes](./fixes/) - Notable fixes worth remembering
- [Solutions](./solutions/) - Reusable technical solutions
- [Migrations](./migrations/) - Notes on notable code and schema migrations
- [Postmortems](./postmortems/) - Incident reports, dated

## Root-Level Documents

- [Test Isolation Solution](./test-isolation-solution.md) - The vitest setup that stopped tests from hanging
- [Mock Isolation Fix](./mock-isolation-fix.md) - Mock lifecycle fixes that accompanied it
- [Testing Patterns](./testing-patterns.md) - Patterns for writing tests
- [Date Formatting Guide](./date-formatting-guide.md) - Date and time display conventions
- [Icon System](./icon-system.md) - Icon usage and the icon component
- [Social Cards](./social-cards.md) - Social card generation
- [Pricing Structure](./pricing-structure.md) - Plans and tiers
- [Workspace Member Management](./workspace-member-management.md) - Roles, invites, and limits
- [Sentry MCP Setup](./sentry-mcp-setup.md) - Connecting the Sentry MCP server
- [Continue Agents Setup](./continue-agents-setup.md) - The Continue agents GitHub workflow
- [Terms of Use - GitHub App](./terms-of-use-github-app.md) - GitHub App terms

## Documentation Standards

1. **Naming**: kebab-case, lowercase file names. `README.md` is the only capitalized name.
2. **Structure**: every folder has a `README.md` that indexes its contents with a one-line description each.
3. **Postmortems**: go in `postmortems/` named `YYYY-MM-DD-slug.md`.
4. **No work logs**: do not add "summary of changes", "fix applied", or phase-completion notes. Put lasting information in the feature or architecture doc it belongs to, or in a postmortem.
5. **Keep it current**: when code changes, update or delete the doc that described it.
