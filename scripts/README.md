# Scripts Directory

Comprehensive collection of automation, testing, and maintenance scripts for the contributor.info platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run common tasks
npm run build
npm run health:check
npm run test:integration
```

## ⚠️ Security Note

**NEVER commit API keys or secrets to the repository!** All sensitive values must be stored in environment variables.

## 📁 Directory Structure

### 🎨 Asset Management
- [`assets/`](./assets/) - Social cards, PWA icons, image optimization
- [`screenshots/`](./screenshots/) - Screenshot generation utilities

### 🔄 Data Operations  
- [`data-sync/`](./data-sync/) - Repository data fetching and synchronization
- [`progressive-capture/`](./progressive-capture/) - Intelligent hybrid data processing
- [`validation/`](./validation/) - Data integrity and gap validation
- [`migrations/`](./migrations/) - Database migration management

### 🏗️ Infrastructure & Deployment
- [`setup/`](./setup/) - Platform configuration and initialization
- [`github-actions/`](./github-actions/) - GitHub Actions workflow scripts
- [`monitoring/`](./monitoring/) - System health and corruption monitoring
- [`health-checks/`](./health-checks/) - Automated system health validation

### 🧪 Testing & Quality
- [`testing/`](./testing/) - Comprehensive system validation
- [`testing-tools/`](./testing-tools/) - API, queue, and UI testing utilities
- [`debugging/`](./debugging/) - Troubleshooting and diagnostic tools

### ⚡ Performance & Optimization
- [`performance/`](./performance/) - Bundle analysis and performance monitoring
- [`optimization/`](./optimization/) - System performance optimization
- [`load-testing/`](./load-testing/) - Stress testing and load validation

### 🔧 Utilities & Maintenance
- [`utilities/`](./utilities/) - General-purpose tools and AI operations
- [`sitemap/`](./sitemap/) - SEO and sitemap management
- [`citation-tracking/`](./citation-tracking/) - LLM citation monitoring
- [`changelog/`](./changelog/) - RSS feed generation
- [`docs/`](./docs/) - Testing documentation and reports

### 📊 Analytics & Features
- `create-posthog-cohorts.js` - PostHog cohort management
- `create-internal-users-cohort.js` - Internal team cohort setup
- `create-workspace-feature-flag.js` - Workspace feature flag management
- `enable-workspaces-for-internal-cohort.js` - Enable workspace features

## 🎯 Common Tasks

### Initial Setup
```bash
# Platform setup
node scripts/setup/setup-supabase-storage.js
node scripts/setup/setup-card-regeneration.js

# Generate seed data
node scripts/setup/generate-seed-data.js
```

### Data Operations
```bash
# Sync repository data
node scripts/data-sync/sync-historical-prs.js --owner facebook --repo react

# Validate data integrity  
node scripts/validation/data-gap-validator.js

# Monitor system health
node scripts/health-checks/check-rollout-health.js
```

### Performance & Testing
```bash
# Run performance checks
node scripts/performance/performance-check.js

# Execute test suite
node scripts/testing/hybrid-system-test.js

# Analyze bundle size
node scripts/performance/analyze-bundle.js
```

## 🔐 Environment Variables

### Required Core Variables
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# GitHub
VITE_GITHUB_TOKEN=your-github-token
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY=your-encoded-private-key

# PostHog (Analytics)
POSTHOG_PROJECT_ID=your-project-id
POSTHOG_PERSONAL_API_KEY=phx_your-personal-api-key
```

### Optional Feature Variables
```bash
# AI Features
OPENAI_API_KEY=your-openai-key

# External Services
VITE_DUB_CO_KEY=your-dub-key
CHROMATIC_PROJECT_TOKEN=your-chromatic-token

# Testing
TEST_GITHUB_TOKEN=your-test-token
```

## 🚦 Script Categories

### 🟢 Safe Scripts (Read-only)
- Health checks and monitoring
- Performance analysis
- Data validation
- Testing utilities

### 🟡 Maintenance Scripts (Modify data)
- Data sync operations
- Cache updates
- Asset generation
- Migration scripts  

### 🔴 Administrative Scripts (System changes)
- User management
- Feature flag updates
- Infrastructure changes
- Security operations

## 📊 Usage Patterns

### Development Workflow
```bash
# 1. Health check
npm run health:check

# 2. Run tests
npm run test:comprehensive  

# 3. Performance check
npm run performance:analyze

# 4. Deploy preparation
npm run build
```

### Production Maintenance
```bash
# Daily tasks
node scripts/health-checks/check-rollout-health.js
node scripts/monitoring/corruption-monitor.js

# Weekly tasks  
node scripts/validation/data-gap-validator.js --all
node scripts/performance/performance-check.js

# Monthly tasks
node scripts/utilities/classify-repositories.ts
node scripts/utilities/regenerate-embeddings.ts
```

### Incident Response
```bash
# Debug issues
node scripts/debugging/debug-github-actions-errors.js
node scripts/debugging/debug-capture-pr.mjs

# Fix data issues
node scripts/progressive-capture/fix-stuck-jobs.js
node scripts/validation/data-gap-validator.js --repository=X

# Recovery operations
node scripts/data-sync/manual-trigger.mjs --repo owner/name
```

## PostHog Management

### Cohort Management
```bash
# Create internal team cohort
node scripts/create-internal-users-cohort.js

# Create property-based cohorts
node scripts/create-posthog-cohorts-simple.js
```

### Feature Flag Management  
```bash
# First, ensure POSTHOG_INTERNAL_TEAM_COHORT_ID is set in .env
node scripts/create-workspace-feature-flag.js

# Enable workspaces for internal cohort
node scripts/enable-workspaces-for-internal-cohort.js
```

### PostHog Troubleshooting
| Issue | Solution |
|-------|----------|
| "POSTHOG_PERSONAL_API_KEY not found" | Add the key to your `.env` file |
| "Failed to create cohort: Forbidden" | Check API key permissions in PostHog |
| "POSTHOG_INTERNAL_TEAM_COHORT_ID not set" | Run cohort script first, add ID to `.env` |
| "Invalid project ID" | Verify POSTHOG_PROJECT_ID matches your PostHog project |

## 🔗 Integration Points

### GitHub Actions
Scripts integrate with CI/CD workflows for:
- Automated testing
- Performance monitoring  
- Data validation
- Health checks

### Supabase Edge Functions
Scripts support serverless functions for:
- Queue processing
- Webhook handling
- Real-time operations
- Background tasks

### External APIs
Scripts interact with:
- GitHub API (data fetching)
- PostHog (analytics)
- OpenAI (embeddings)
- dub.co (URL shortening)

## 📚 Documentation Standards

Each script directory includes:
- **README.md**: Comprehensive usage guide
- **Examples**: Common usage patterns
- **Troubleshooting**: Common issues and solutions
- **Best Practices**: Security and performance tips

## 🆘 Getting Help

1. **Check script README**: Each directory has detailed documentation
2. **Run with --help**: Most scripts support help flags
3. **View logs**: Scripts provide detailed logging
4. **Check environment**: Verify required variables are set

## 🔄 Contributing

When adding new scripts:
1. **Follow naming conventions**: Use kebab-case for files
2. **Add documentation**: Include comprehensive README
3. **Use environment variables**: Never hardcode secrets
4. **Add error handling**: Graceful failure modes
5. **Include examples**: Show common usage patterns
6. **Update this README**: Add to appropriate category

## 📈 Monitoring & Alerts

Key metrics tracked by scripts:
- **System Health**: Uptime, performance, errors
- **Data Quality**: Completeness, consistency, accuracy  
- **Performance**: Response times, throughput, efficiency
- **Security**: Access patterns, anomaly detection

For operational insights, see:
- [Health Checks](./health-checks/README.md)
- [Monitoring](./monitoring/README.md)  
- [Performance](./performance/README.md)

## Security Checklist

- [ ] No API keys in code
- [ ] No hardcoded IDs or secrets
- [ ] `.env` file is in `.gitignore`
- [ ] Environment variables documented in `.env.example`
- [ ] Sensitive values never logged to console
- [ ] Regular security audits of scripts
- [ ] Proper error handling to avoid data leaks