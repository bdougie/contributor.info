# Scripts Directory

Automation tools and utilities for managing the contributor.info platform. These scripts help with performance optimization, data processing, monitoring, and maintenance tasks.

## Quick Start

Most scripts run independently and require minimal setup:

```bash
# Install dependencies if needed
npm install

# Run any script
node scripts/script-name.js
```

## Categories

### 🔍 **Monitoring & Health Checks**
Monitor system performance and detect issues.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-rollout-health.js` | Monitor progressive rollout health | During feature rollouts |
| `check-rollout-percentage.js` | Check current rollout status | Verify rollout configuration |
| `check-repos.mjs` | Validate tracked repositories | Weekly repository audits |
| `check-tracked-repos.mjs` | Check repository tracking status | Troubleshoot tracking issues |
| `monitor-cdn-performance.js` | Monitor CDN and asset performance | Performance troubleshooting |
| `monitor-database-performance.js` | Check database query performance | Database optimization |

### ⚡ **Performance & Optimization**
Improve application speed and reduce resource usage.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-bundle.js` | Analyze build bundle sizes | Before releases |
| `analyze-mobile-performance.js` | Check mobile performance metrics | Mobile optimization |
| `lighthouse-check.js` | Run Lighthouse performance audits | Performance validation |
| `optimize-icon-imports.js` | Optimize icon import statements | Reduce bundle size |
| `performance-check.js` | Comprehensive performance analysis | Regular performance reviews |

### 🔄 **Data Processing**
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

### 🧪 **Testing & Validation**
Ensure system reliability and data integrity.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `test-github-auth.mjs` | Test GitHub API authentication | Debug auth issues |
| `test-inngest.js` | Test Inngest queue functionality | Queue troubleshooting |
| `test-inngest-direct.mjs` | Test direct Inngest event sending | Test event queue directly |
| `test-api-fallback-prevention.mjs` | Verify API fallback prevention works | Ensure efficient data fetching |
| `test-new-repo-tracking.mjs` | Test new repository tracking flow | Validate repo onboarding |
| `test-review-sync.mjs` | Test PR review syncing functionality | Debug review data issues |
| `test-sync-logging.mjs` | Test sync logging functionality | Verify logging system |
| `test-update-activity.mjs` | Test PR activity update functionality | Debug activity updates |
| `test-social-cards.js` | Validate social card generation | Social media debugging |
| `verify-embeddings.ts` | Verify AI embedding accuracy | AI feature validation |
| `verify-social-card-system.js` | Test complete social card system | End-to-end validation |

### 🛠️ **Setup & Configuration**
Initialize and configure system components.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-supabase-storage.js` | Configure Supabase storage buckets | Initial deployment |
| `setup-card-regeneration.js` | Setup social card regeneration | Social features setup |
| `encode-private-key.js` | Encode GitHub private keys | Security configuration |
| `prepare-private-key.sh` | Prepare GitHub App private keys | Deployment setup |

### 🎨 **Asset Generation**
Create and manage visual assets.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `generate-social-cards.js` | Generate repository social cards | Marketing assets |
| `generate-pwa-icons.js` | Create PWA app icons | Mobile app updates |
| `generate-pwa-screenshots.js` | Generate app store screenshots | App store submissions |
| `convert-images.js` | Convert and optimize images | Image preprocessing |

### 🔧 **Development Tools**
Support development and debugging workflows.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `debug-github-actions-errors.js` | Debug GitHub Actions failures | CI/CD troubleshooting |
| `debug-ui-events.js` | Debug frontend user interactions | UI issue investigation |
| `debug-capture-pr.mjs` | Debug PR capture functionality | Troubleshoot PR data capture |
| `search-user-reviews.mjs` | Search and analyze user PR reviews | Find specific user contributions |
| `check-build-clean.js` | Verify clean build output | Pre-release validation |
| `fix-inngest-local.sh` | Fix local Inngest development | Local development setup |

## Subfolders

### 🚀 `/github-actions/`
Scripts designed to run in GitHub Actions workflows for automated processing.

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-rate-limit.js` | Check GitHub API rate limits | Before API-intensive operations |
| `progressive-backfill.js` | Process large repository backfills | Scheduled backfill workflows |
| `capture-pr-details-graphql.js` | Capture PR details via GraphQL | GitHub Actions PR processing |
| `report-failure.js` | Report workflow failures as GitHub issues | Automated failure notifications |
| `lib/graphql-client.js` | Simple GraphQL client for Actions | GraphQL operations in workflows |
| `lib/chunk-calculator.js` | Calculate optimal processing chunks | Batch processing operations |
| `lib/progress-tracker.js` | Track backfill progress | Long-running operations |
| `lib/github-issue-reporter.js` | Create/update GitHub issues | Automated issue management |

### 📊 `/monitoring/`
Advanced monitoring and cost analysis tools.

### ⚡ `/optimization/`
Performance optimization utilities for GitHub Actions and Inngest.

### 🔄 `/progressive-capture/`
Progressive data capture system for efficient GitHub data processing.

### 🧪 `/testing/`
Comprehensive testing utilities for edge cases and system validation.

### ✅ `/validation/`
Data integrity and gap validation tools.

### 📈 `/rollout/`
Rollout management and monitoring system. See `/rollout/README.md` for detailed documentation.

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
node scripts/check-rollout-health.js
node scripts/monitor-database-performance.js
node scripts/check-repos.mjs
```

#### Performance Analysis
```bash
node scripts/analyze-bundle.js
node scripts/lighthouse-check.js
node scripts/performance-check.js
```

#### Data Refresh
```bash
node scripts/check-tracked-repos.mjs
node scripts/refresh-stale-repos.js
node scripts/trigger-refresh.js
```

## Support

- **For rollout management**: See `/scripts/rollout/README.md`
- **For progressive capture**: See `/scripts/progressive-capture/README.md`
- **For monitoring**: See `/scripts/monitoring/README.md`
- **For performance issues**: See `/scripts/optimization/README.md`

## Safety Notes

- **Always backup data** before running processing scripts
- **Test in development** before running in production
- **Monitor system health** after script execution
- **Check rollout status** before making system changes

Scripts follow the project's user-friendly, action-oriented approach—focusing on what you can do rather than technical implementation details.