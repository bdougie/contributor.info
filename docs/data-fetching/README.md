# Data Fetching Documentation

How contributor.info pulls GitHub data into Supabase: the database-first strategy,
Inngest background jobs, GitHub Actions for large backfills, and the throttling
and monitoring around them. Repository tracking is manual and user-initiated
(see AGENTS.md); nothing here auto-discovers repositories.

## Architecture

- [Smart Data Fetching Architecture](./smart-data-fetching.md) - Overall design of the fetching pipeline
- [Database-First Smart Fetching](./database-first-smart-fetching.md) - Query cached data first, fetch from GitHub in the background
- [System Diagram](./system-diagram.md) - Component and data flow diagram
- [GitHub API Strategy](./api-strategy.md) - When the code uses GraphQL versus REST
- [Size Classification](./size-classification.md) - Repository size tiers that drive fetch strategy
- [Hybrid Rollout Configuration](./hybrid-rollout-configuration.md) - Routing between Inngest and GitHub Actions

## Repository Tracking

- [Manual Repository Tracking System](./manual-repository-tracking.md) - The "Track This Repository" flow
- [Repository Tracking Guide](./repository-tracking-guide.md) - Operator guide for tracking and untracking
- [On-Demand GitHub Sync](./on-demand-sync-guide.md) - User-triggered syncs

## Background Jobs

- [Inngest Queue Integration](./inngest-integration.md) - Event names, functions, and job flow
- [Inngest Client-Safe Event Sending](./inngest-client-safe.md) - Sending events from the browser without exposing keys
- [Inngest Function Timeout Optimizations](./inngest-timeout-optimizations.md) - Keeping functions inside runtime limits
- [Inngest Troubleshooting](./inngest-troubleshooting.md) - Common failures and how to debug them
- [GitHub Actions Workflows](./github-actions-workflows.md) - Workflows used for large historical backfills
- [Queue Management](./queue-management.md) - The progressive capture job queue
- [Webhook Priority System](./webhook-priority-system.md) - Prioritizing webhook-driven updates
- [Workspace Priority System](./workspace-priority-system.md) - Prioritizing repositories that belong to workspaces

## Throttling and Rate Limits

- [Smart Throttling System](./smart-throttling-system.md) - Per-repository sync throttling
- [Rate Limiting Fixes](./rate-limiting-fixes.md) - Concurrency and throttle settings currently in code

## Specific Data Types

- [Commit Data Capture](./commit-data-capture.md) - Capturing commits and file changes
- [Discussion Background Sync](./discussion-background-sync.md) - Syncing GitHub Discussions
- [Bot Detection](./bot-detection.md) - Centralized bot detection used across contributor metrics
- [Workspace Issue Sync Architecture](./workspace-issue-sync-architecture.md) - Issue sync for workspace repositories
- [OpenAI Token Tracker](./token-tracker.md) - Token accounting for LLM calls

## Backfills

- [Manual Backfill Service Setup](./manual-backfill-setup.md) - The manual backfill Netlify function
- [Workspace Manual Backfill](./workspace-manual-backfill.md) - Backfilling a whole workspace

## Operations

- [Monitoring Capture Health](./monitoring-capture-health.md) - Health checks and dashboards
- [Data Analysis Scripts](./data-analysis-scripts.md) - Scripts for inspecting captured data

## Related Documentation

- [Infrastructure](../infrastructure/) - Inngest on Supabase, Netlify functions, Fly.io webhooks
- [Edge Functions](../edge-functions/) - Supabase edge function guides
- [Postmortems](../postmortems/) - Incident history, including several sync failures
