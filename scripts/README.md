# Scripts Directory

Automation tools and utilities for managing the contributor.info platform. These scripts help with performance optimization, data processing, monitoring, and maintenance tasks.

## Quick Start

Most scripts run independently and require minimal setup:

```bash
# Install dependencies if needed
npm install

# Run any script
node scripts/[folder]/script-name.js
```

## Categories

### 📊 **[Data Sync](./data-sync/)** 
Sync and manage GitHub data.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `backfill-pr-stats.js` | Backfill missing PR statistics | Data recovery |
| `backfill-reviews-comments.mjs` | Backfill missing PR reviews and comments | Fill gaps in review/comment data |
| `sync-historical-prs.js` | Sync historical pull request data | Initial setup or data recovery |
| `sync-historical-comments.js` | Sync historical PR comments | Complete data backfills |
| `sync-historical-reviews.js` | Sync historical PR reviews | Review data backfills |
| `refresh-stale-repos.js` | Refresh outdated repository data | Monthly maintenance |
| `trigger-refresh.js` | Manually trigger data refresh | Force data updates |
| `manual-trigger.mjs` | Manually trigger data refresh for specific repos | Target specific repository updates |
| `get-pytorch-stats.js` | Get accurate GitHub repository statistics | Verify repository data |
| `initialize-pytorch-backfill.js` | Initialize large repository backfill | Start progressive backfill |
| `manual-sync-repository.js` | Manually sync individual repositories | Force sync specific repo |
| `sync-bdougie-repos.js` | Direct GitHub API sync for specific repos | Sync bdougie repositories |
| `sync-all-tracked-repos.js` | Bulk sync all tracked repositories | Sync all repos with rate limiting |
| `test-406-fix-and-sync.js` | Test 406 error fix and sync functionality | Verify 406 fix works |

### ⚡ **[Performance](./performance/)**
Improve application speed and reduce resource usage.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-bundle.js` | Analyze build bundle sizes | Before releases |
| `analyze-mobile-performance.js` | Check mobile performance metrics | Mobile optimization |
| `lighthouse-check.js` | Run Lighthouse performance audits | Performance validation |
| `performance-check.js` | Comprehensive performance analysis | Regular performance reviews |
| `monitor-cdn-performance.js` | Monitor CDN and asset performance | Performance troubleshooting |
| `monitor-database-performance.js` | Check database query performance | Database optimization |
| `test-core-web-vitals.js` | Test Core Web Vitals (LCP, CLS, INP) | Measure UX performance metrics |

### 🎨 **[Assets](./assets/)**
Create and manage visual assets.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `generate-social-cards.js` | Generate repository social cards | Marketing assets |
| `generate-pwa-icons.js` | Create PWA app icons | Mobile app updates |
| `generate-pwa-screenshots.js` | Generate app store screenshots | App store submissions |
| `convert-images.js` | Convert and optimize images | Image preprocessing |
| `build-with-social-cards.js` | Build with social card generation | Integrated build process |

### 🛠️ **[Setup](./setup/)**
Initialize and configure system components.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-supabase-storage.js` | Configure Supabase storage buckets | Initial deployment |
| `setup-card-regeneration.js` | Setup social card regeneration | Social features setup |
| `setup-chromatic-baselines.sh` | Setup visual testing baselines | CI/CD configuration |
| `encode-private-key.js` | Encode GitHub private keys | Security configuration |
| `prepare-private-key.sh` | Prepare GitHub App private keys | Deployment setup |

### 🔍 **[Debugging](./debugging/)**
Support development and debugging workflows.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `debug-github-actions-errors.js` | Debug GitHub Actions failures | CI/CD troubleshooting |
| `debug-ui-events.js` | Debug frontend user interactions | UI issue investigation |
| `debug-capture-pr.mjs` | Debug PR capture functionality | Troubleshoot PR data capture |
| `check-build-clean.js` | Verify clean build output | Pre-release validation |
| `check-commits.cjs` | Analyze commit patterns | Git history debugging |
| `fix-inngest-local.sh` | Fix local Inngest development | Local development setup |

### 🏥 **[Health Checks](./health-checks/)**
Monitor system performance and detect issues.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-rollout-health.js` | Monitor progressive rollout health | During feature rollouts |
| `check-rollout-percentage.js` | Check current rollout status | Verify rollout configuration |
| `check-repos.mjs` | Validate tracked repositories | Weekly repository audits |
| `check-tracked-repos.mjs` | Check repository tracking status | Troubleshoot tracking issues |
| `check-bucket-status.js` | Verify storage bucket health | Storage troubleshooting |
| `check-inngest-registration.js` | Check Inngest queue registration | Queue system validation |

### 🧪 **[Testing Tools](./testing-tools/)**
Ensure system reliability and data integrity. See [README](./testing-tools/README.md) for detailed documentation.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `test-api-fallback-prevention.mjs` | Verify API fallback prevention works | Ensure efficient data fetching |
| `test-ci-environment.js` | Test CI/CD environment configuration | Validate CI setup |
| `test-console-warn.js` | Test console warning detection | Debug console output |
| `test-event-flow.js` | Test event processing flow | Validate event handling |
| `test-github-auth.mjs` | Test GitHub API authentication | Debug auth issues |
| `test-inngest.js` | Test Inngest queue functionality | Queue troubleshooting |
| `test-inngest-direct.mjs` | Test direct Inngest event sending | Test event queue directly |
| `test-last-updated-logic.js` | Test last updated timestamp logic | Verify timestamp calculations |
| `test-new-repo-tracking.mjs` | Test new repository tracking flow | Validate repo onboarding |
| `test-production-inngest.js` | Test production Inngest connection | Production queue validation |
| `test-review-sync.mjs` | Test PR review syncing functionality | Debug review data issues |
| `test-sanitize.js` | Test HTML sanitization | Security validation |
| `test-social-cards.js` | Validate social card generation | Social media debugging |
| `test-storybook-interactions.sh` | Test Storybook interaction tests | UI component testing |
| `test-sync-logger.js` | Test sync logging functionality | Debug sync operations |
| `test-sync-logging.mjs` | Test sync logging with ES modules | Modern sync debugging |
| `test-update-activity.mjs` | Test activity update functionality | Validate activity tracking |
| `test-visual-regression.sh` | Run visual regression tests | UI change validation |
| `test-visual-workflow.sh` | Test visual workflow automation | Visual testing pipeline |

### 🔧 **[Utilities](./utilities/)**
General-purpose tools and maintenance scripts.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `classify-repositories.ts` | Categorize repositories by type/language | Data analysis |
| `regenerate-embeddings.ts` | Rebuild AI embeddings | Search optimization |
| `verify-embeddings.ts` | Verify AI embedding accuracy | AI feature validation |
| `search-user-reviews.mjs` | Search and analyze user PR reviews | Find specific user contributions |
| `optimize-icon-imports.js` | Optimize icon import statements | Reduce bundle size |
| `verify-social-card-system.js` | Test complete social card system | End-to-end validation |
| `update-rollout.js` | Update feature rollout configuration | Feature flag management |

## Subfolders

### 🚀 **[/github-actions/](./github-actions/)**
Scripts designed to run in GitHub Actions workflows for automated processing.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-rate-limit.js` | Check GitHub API rate limits | Before API-intensive operations |
| `progressive-backfill.js` | Process large repository backfills | Scheduled backfill workflows |
| `capture-pr-details-graphql.js` | Capture PR details via GraphQL | GitHub Actions PR processing |
| `report-failure.js` | Report workflow failures as GitHub issues | Automated failure notifications |

### 📊 **[/monitoring/](./monitoring/)**
Advanced monitoring and cost analysis tools. See [README](./monitoring/README.md) for details.

### ⚡ **[/optimization/](./optimization/)**
Performance optimization utilities for GitHub Actions and Inngest. See [README](./optimization/README.md) for details.

### 🔄 **[/progressive-capture/](./progressive-capture/)**
Progressive data capture system for efficient GitHub data processing. See [README](./progressive-capture/README.md) for details.

### 🧪 **[/testing/](./testing/)**
Comprehensive testing utilities for edge cases and system validation. See [README](./testing/README.md) for details.

### ✅ **[/validation/](./validation/)**
Data integrity and gap validation tools. See [README](./validation/README.md) for details.

### 📈 **[/rollout/](./rollout/)**
Rollout management and monitoring system. See [README](./rollout/README.md) for detailed documentation.

## Usage Guidelines

### Environment Setup

Most scripts require environment variables:

```bash
# Required for most scripts
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_TOKEN=your-service-role-key
VITE_GITHUB_TOKEN=your-github-token

# Optional for specific scripts
INNGEST_EVENT_KEY=your-inngest-key
```

### Running Scripts Safely

1. **Start with monitoring scripts** to understand current system state
2. **Use validation scripts** before making changes
3. **Run test scripts** in development first
4. **Monitor health checks** after running data processing scripts

### Common Workflows

#### System Health Check
```bash
node scripts/health-checks/check-rollout-health.js
node scripts/performance/monitor-database-performance.js
node scripts/health-checks/check-repos.mjs
```

#### Performance Analysis
```bash
node scripts/performance/analyze-bundle.js
node scripts/performance/lighthouse-check.js
node scripts/performance/performance-check.js
```

#### Data Refresh
```bash
node scripts/health-checks/check-tracked-repos.mjs
node scripts/data-sync/refresh-stale-repos.js
node scripts/data-sync/trigger-refresh.js
```

## Support

- **For specific script documentation**: Check the README in each subfolder
- **For rollout management**: See [/scripts/rollout/README.md](./rollout/README.md)
- **For progressive capture**: See [/scripts/progressive-capture/README.md](./progressive-capture/README.md)
- **For monitoring**: See [/scripts/monitoring/README.md](./monitoring/README.md)

## Safety Notes

- **Always backup data** before running processing scripts
- **Test in development** before running in production
- **Monitor system health** after script execution
- **Check rollout status** before making system changes

Scripts follow the project's user-friendly, action-oriented approach—focusing on what you can do rather than technical implementation details.