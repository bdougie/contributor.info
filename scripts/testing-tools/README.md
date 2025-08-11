# Testing Tools

Comprehensive testing utilities for validating system functionality, API integrations, and feature implementations.

## 🧪 Overview

Testing tools cover:
- API authentication and integration testing
- Queue system validation
- Feature functionality verification
- Visual and interaction testing

## 🔬 Scripts

### Authentication & API
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test-github-auth.mjs` | Test GitHub API authentication | Auth issues |
| `test-api-fallback-prevention.mjs` | Verify efficient API usage | Performance testing |

### Queue System (Inngest)
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test-inngest.js` | Test Inngest queue functionality | Queue issues |
| `test-inngest-direct.mjs` | Direct event sending tests | Event debugging |
| `test-production-inngest.js` | Production queue validation | Pre-deployment |
| `test-event-flow.js` | End-to-end event flow | Integration testing |

### Data Sync Testing
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test-new-repo-tracking.mjs` | Test repository onboarding | New repo setup |
| `test-review-sync.mjs` | Validate review syncing | Review data issues |
| `test-sync-logger.js` | Test logging functionality | Debug logging |
| `test-sync-logging.mjs` | Sync operation logging | Troubleshooting |
| `test-update-activity.mjs` | PR activity updates | Activity tracking |

### UI & Visual Testing
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test-social-cards.js` | Social card generation | Card issues |
| `test-storybook-interactions.sh` | Storybook interaction tests | UI changes |
| `test-visual-regression.sh` | Visual regression testing | Before release |
| `test-visual-workflow.sh` | Visual testing workflow | CI/CD |

### Environment & Utility Testing
| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test-ci-environment.js` | CI environment validation | CI/CD setup |
| `test-console-warn.js` | Console warning detection | Debug output issues |
| `test-last-updated-logic.js` | Timestamp calculation testing | Date logic validation |
| `test-sanitize.js` | HTML sanitization testing | Security validation |

## 💡 Usage Examples

### API Testing Suite
```bash
# Test GitHub authentication
node scripts/testing-tools/test-github-auth.mjs

# Verify API efficiency
node scripts/testing-tools/test-api-fallback-prevention.mjs --verbose

# Full API test suite
npm run test:api
```

### Queue System Testing
```bash
# Test local Inngest
node scripts/testing-tools/test-inngest.js

# Test production queue
INNGEST_ENV=production node scripts/testing-tools/test-production-inngest.js

# Test specific event
node scripts/testing-tools/test-inngest-direct.mjs --event "capture/repository.sync"
```

### Data Sync Testing
```bash
# Test new repository tracking
node scripts/testing-tools/test-new-repo-tracking.mjs --repo "facebook/react"

# Test review sync
node scripts/testing-tools/test-review-sync.mjs --pr 12345

# Test activity updates
node scripts/testing-tools/test-update-activity.mjs --days 7
```

### Visual Testing
```bash
# Run visual regression tests
./scripts/testing-tools/test-visual-regression.sh

# Test Storybook interactions
./scripts/testing-tools/test-storybook-interactions.sh

# Test social cards
node scripts/testing-tools/test-social-cards.js --all
```

### Utility & Security Testing
```bash
# Test console warnings in components
node scripts/testing-tools/test-console-warn.js

# Test timestamp logic
node scripts/testing-tools/test-last-updated-logic.js

# Test HTML sanitization for XSS prevention
node scripts/testing-tools/test-sanitize.js

# Validate CI environment
node scripts/testing-tools/test-ci-environment.js
```

## 🎯 Test Scenarios

### Authentication Tests
```javascript
{
  scenarios: [
    "Valid token authentication",
    "Expired token handling",
    "Rate limit behavior",
    "Scope verification",
    "Error recovery"
  ]
}
```

### Queue Tests
```javascript
{
  events: [
    "capture/repository.sync",
    "capture/pr.details",
    "process/embeddings.generate",
    "notify/webhook.send"
  ],
  validations: [
    "Event delivery",
    "Retry logic",
    "Error handling",
    "Concurrency limits"
  ]
}
```

### Visual Tests
```javascript
{
  components: [
    "ContributorCard",
    "RepositoryStats",
    "PRTimeline",
    "Dashboard"
  ],
  viewports: [
    { width: 375, height: 667 },  // Mobile
    { width: 768, height: 1024 }, // Tablet
    { width: 1920, height: 1080 } // Desktop
  ]
}
```

## ✅ Test Results

### Result Format
```javascript
{
  suite: "API Authentication",
  passed: 18,
  failed: 2,
  duration: "2.3s",
  failures: [{
    test: "Rate limit recovery",
    error: "Timeout waiting for rate limit reset",
    suggestion: "Increase timeout or mock rate limit"
  }]
}
```

### Success Criteria
- **Unit Tests**: 100% pass rate
- **Integration Tests**: >95% pass rate
- **Visual Tests**: No unintended changes
- **Performance**: Within benchmarks

## 🔄 Continuous Testing

### Pre-commit Hooks
```bash
# .git/hooks/pre-commit
npm run test:api
npm run test:visual-quick
```

### CI Pipeline
```yaml
- name: Run Test Suite
  run: |
    npm run test:auth
    npm run test:sync
    npm run test:visual
```

### Scheduled Tests
```bash
# Daily comprehensive test
0 2 * * * npm run test:comprehensive

# Hourly health check
0 * * * * npm run test:health
```

## 🐛 Test Debugging

### Debug Mode
```bash
# Enable debug output
DEBUG=test:* node scripts/testing-tools/test-inngest.js

# Verbose logging
node scripts/testing-tools/test-github-auth.mjs --verbose --log-level debug
```

### Test Isolation
```bash
# Run single test
node scripts/testing-tools/test-review-sync.mjs --only "creates review"

# Skip flaky tests
node scripts/testing-tools/test-event-flow.js --skip-flaky
```

## 📊 Test Coverage

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage
open coverage/index.html
```

### Coverage Targets
- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## 🔧 Test Configuration

### Test Environment
```javascript
// config/test.js
export default {
  github: {
    token: process.env.TEST_GITHUB_TOKEN,
    repo: "test-org/test-repo"
  },
  timeouts: {
    api: 5000,
    visual: 30000,
    queue: 10000
  },
  retries: 3
}
```

### Mock Data
```javascript
// Use consistent test data
import { mockPR, mockRepo, mockUser } from './fixtures'
```

## 🚨 Common Test Issues

### "Authentication failed"
- Check TEST_GITHUB_TOKEN
- Verify token scopes
- Check rate limits

### "Visual regression detected"
- Review screenshots
- Update baselines if intended
- Check responsive breakpoints

### "Queue timeout"
- Increase timeout values
- Check Inngest connection
- Verify event schemas

## 📚 Best Practices

1. **Isolation**: Tests should not depend on external state
2. **Deterministic**: Same input = same output
3. **Fast**: Keep tests under 5 seconds
4. **Clear**: Descriptive test names and errors
5. **Maintained**: Update tests with code changes

## 🔗 Related Tools

- **Jest**: Unit testing framework
- **Playwright**: Visual testing
- **Storybook**: Component testing
- **GitHub Actions**: CI/CD integration