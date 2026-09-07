# PostHog Scripts

Idempotent setup scripts for PostHog cohorts and feature flags. Each needs `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` in the environment and upserts by name, so re-running is safe.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `create-posthog-cohorts.js` | `npm run setup-cohorts` | Create the property-based cohorts used for analytics segmentation |
| `create-internal-users-cohort.js` | `node scripts/posthog/create-internal-users-cohort.js` | Create the Internal Team cohort that filters staff out of analytics |
| `create-workspace-feature-flag.js` | `node scripts/posthog/create-workspace-feature-flag.js` | Create the `enable_workspace_creation` flag targeted at the Internal Team cohort. Run the cohort script first |

## Related

- [docs/analytics/](../../docs/analytics/) - PostHog strategy and event catalog
- [docs/features/posthog-integration.md](../../docs/features/posthog-integration.md)
- [docs/features/feature-flags-quick-reference.md](../../docs/features/feature-flags-quick-reference.md)
