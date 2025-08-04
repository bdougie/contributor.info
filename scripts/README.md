# Scripts Directory

Automation tools and utilities for managing the contributor.info platform. These scripts are organized into logical categories for easier navigation and maintenance.

## 📁 Directory Structure

```
scripts/
├── assets/              # Visual asset generation (social cards, PWA icons)
├── data-sync/           # GitHub data fetching and synchronization
├── debugging/           # Troubleshooting and diagnostic tools
├── github-actions/      # Scripts for GitHub Actions workflows
├── health-checks/       # System health monitoring
├── monitoring/          # Performance and cost monitoring
├── optimization/        # Performance optimization utilities
├── performance/         # Performance analysis and benchmarking
├── progressive-capture/ # Efficient data capture system
├── rollout/            # Feature rollout management
├── setup/              # Initial setup and configuration
├── testing/            # Testing utilities and edge cases
├── testing-tools/      # Test execution and validation
├── utilities/          # General-purpose tools
└── validation/         # Data integrity validation
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run a script from any subfolder
node scripts/[folder]/[script-name].js

# Example: Run a data sync script
node scripts/data-sync/sync-historical-prs.js
```

## 📚 Categories

### 📊 **[data-sync/](./data-sync/)**
Scripts for fetching, syncing, and backfilling GitHub repository data.
- Initial repository setup
- Historical data backfilling
- Progressive updates for large repos (100k+ PRs)
- **[View Documentation](./data-sync/README.md)**

### ⚡ **[performance/](./performance/)**
Tools for analyzing and optimizing application performance.
- Bundle size analysis
- Lighthouse audits
- Database performance monitoring
- **[View Documentation](./performance/README.md)**

### 🎨 **[assets/](./assets/)**
Generate and optimize visual assets.
- Social media cards (Open Graph/Twitter)
- PWA icons and screenshots
- Image format conversion
- **[View Documentation](./assets/README.md)**

### 🔧 **[setup/](./setup/)**
Configuration scripts for platform initialization.
- Storage bucket setup
- Security key management
- Infrastructure configuration
- **[View Documentation](./setup/README.md)**

### 🔍 **[debugging/](./debugging/)**
Troubleshooting tools for development and production issues.
- GitHub Actions debugging
- UI event tracing
- Data capture diagnostics
- **[View Documentation](./debugging/README.md)**

### 🏥 **[health-checks/](./health-checks/)**
Monitor system health and catch issues early.
- Rollout health monitoring
- Repository validation
- Infrastructure status checks
- **[View Documentation](./health-checks/README.md)**

### 🧪 **[testing-tools/](./testing-tools/)**
Comprehensive testing utilities.
- API authentication tests
- Queue system validation
- Visual regression testing
- **[View Documentation](./testing-tools/README.md)**

### 🛠️ **[utilities/](./utilities/)**
General-purpose maintenance and analysis tools.
- Repository classification
- AI embedding management
- System maintenance utilities
- **[View Documentation](./utilities/README.md)**

## 📂 Specialized Folders

### 🚀 **[github-actions/](./github-actions/)**
Scripts designed for GitHub Actions workflows.
- Rate limit management
- Progressive backfill processing
- Automated failure reporting
- **[View Documentation](./github-actions/README.md)**

### 📊 **[monitoring/](./monitoring/)**
Advanced monitoring and cost analysis.
- Performance tracking
- Cost optimization
- Usage analytics
- **[View Documentation](./monitoring/README.md)**

### ⚡ **[optimization/](./optimization/)**
Performance optimization utilities.
- GitHub Actions optimization
- Inngest queue optimization
- Resource usage reduction
- **[View Documentation](./optimization/README.md)**

### 🔄 **[progressive-capture/](./progressive-capture/)**
Efficient data capture system.
- Incremental data fetching
- Rate limit management
- Progress tracking
- **[View Documentation](./progressive-capture/README.md)**

### 🧪 **[testing/](./testing/)**
Edge case testing utilities.
- Complex scenario testing
- Integration test helpers
- **[View Documentation](./testing/README.md)**

### ✅ **[validation/](./validation/)**
Data integrity and validation.
- Data gap detection
- Consistency checking
- **[View Documentation](./validation/README.md)**

### 📈 **[rollout/](./rollout/)**
Feature rollout management.
- Progressive deployment
- A/B testing support
- Rollback procedures
- **[View Documentation](./rollout/README.md)**

## ⚙️ Environment Setup

Most scripts require environment variables:

```bash
# Core Requirements
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_TOKEN=your-service-role-key
VITE_GITHUB_TOKEN=your-github-token

# Optional Services
INNGEST_EVENT_KEY=your-inngest-key
CHROMATIC_PROJECT_TOKEN=your-chromatic-token
```

## 🏃 Common Workflows

### Daily Health Check
```bash
# Check system health
node scripts/health-checks/check-rollout-health.js
node scripts/health-checks/check-repos.mjs

# Monitor performance
node scripts/performance/monitor-database-performance.js
```

### Data Maintenance
```bash
# Refresh stale data
node scripts/data-sync/refresh-stale-repos.js

# Backfill missing data
node scripts/data-sync/backfill-pr-stats.js --days 7
```

### Pre-Release Checklist
```bash
# Performance audit
node scripts/performance/performance-check.js
node scripts/performance/analyze-bundle.js

# Visual regression
./scripts/testing-tools/test-visual-regression.sh

# System validation
node scripts/health-checks/check-rollout-health.js
```

## 🔍 Finding Scripts

### By Task
- **Sync GitHub data**: Check `data-sync/`
- **Fix performance issues**: Check `performance/` and `optimization/`
- **Debug problems**: Check `debugging/`
- **Run tests**: Check `testing-tools/`

### By Technology
- **GitHub API**: `data-sync/`, `github-actions/`
- **Supabase**: `setup/`, `health-checks/`
- **Inngest**: `debugging/`, `optimization/`
- **PWA/Mobile**: `assets/`, `performance/`

## 📝 Best Practices

1. **Read folder README first**: Each folder has detailed documentation
2. **Check dependencies**: Some scripts require specific setup
3. **Use dry-run when available**: Test before making changes
4. **Monitor after running**: Check system health post-execution
5. **Keep scripts updated**: Update when APIs or dependencies change

## 🆘 Getting Help

- **Script fails**: Check the folder's README for troubleshooting
- **Missing dependencies**: Run `npm install` in the project root
- **Permission errors**: Check environment variables and API tokens
- **Need new script**: Use existing scripts as templates

## 🔒 Security Notes

- Never commit API keys or tokens
- Use environment variables for sensitive data
- Be cautious with scripts that modify data
- Review script actions before running in production