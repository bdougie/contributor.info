# Debugging Scripts

Tools for troubleshooting, debugging, and diagnosing issues in the contributor.info platform.

## 🔍 Overview

Debugging scripts help:
- Diagnose GitHub Actions failures
- Debug UI interactions and events
- Troubleshoot data capture issues
- Analyze build problems

## 🛠️ Scripts

| Script | Purpose | Use Case |
|--------|---------|----------|
| `debug-github-actions-errors.js` | Analyze GitHub Actions failures | CI/CD troubleshooting |
| `debug-ui-events.js` | Debug frontend interactions | UI issue investigation |
| `debug-capture-pr.mjs` | Debug PR data capture | Data sync issues |
| `check-build-clean.js` | Verify clean build output | Build validation |
| `check-commits.cjs` | Analyze commit patterns | Git history debugging |
| `fix-inngest-local.sh` | Fix local Inngest setup | Development environment |
| `start-inngest-local.sh` | Start Inngest for debugging | Local queue testing |

## 💡 Usage Examples

### GitHub Actions Debugging
```bash
# Analyze recent workflow failures
node scripts/debugging/debug-github-actions-errors.js --workflow "Progressive Backfill"

# Debug specific run
node scripts/debugging/debug-github-actions-errors.js --run-id 12345
```

### UI Event Debugging
```bash
# Start UI event monitor
node scripts/debugging/debug-ui-events.js --verbose

# Debug specific component
node scripts/debugging/debug-ui-events.js --component "ContributorCard"
```

### Data Capture Debugging
```bash
# Debug PR capture for specific repo
node scripts/debugging/debug-capture-pr.mjs --owner pytorch --repo pytorch --pr 12345

# Test capture with verbose logging
node scripts/debugging/debug-capture-pr.mjs --verbose --dry-run
```

### Local Development
```bash
# Fix Inngest local setup
./scripts/debugging/fix-inngest-local.sh

# Start Inngest with debug logging
./scripts/debugging/start-inngest-local.sh --debug
```

## 🔎 Debug Output

### GitHub Actions Analysis
```
Workflow: Progressive Backfill
Status: Failed
Duration: 2m 34s

Error Summary:
- Step: Run progressive backfill
- Error: Rate limit exceeded
- Context: Processing chunk 42
- Suggestion: Reduce chunk size or add delay

Related Logs:
[2024-03-15 10:23:45] API rate limit: 0/5000
[2024-03-15 10:23:46] Error: HttpError 403
```

### UI Event Trace
```
Event Flow:
1. Click: ContributorCard (id: contrib-123)
   ↓ 125ms
2. State Update: selectedContributor
   ↓ 15ms
3. API Call: /api/contributor/123
   ↓ 230ms
4. Render: ContributorDetails
   
Total Time: 370ms
Performance: ⚠️ (target: <300ms)
```

## 🧰 Debug Modes

### Verbose Logging
```bash
# Enable detailed logging
DEBUG=* node scripts/debugging/debug-capture-pr.mjs

# Specific namespaces
DEBUG=github:*,supabase:* node scripts/debugging/debug-ui-events.js
```

### Dry Run Mode
```bash
# Test without making changes
node scripts/debugging/debug-capture-pr.mjs --dry-run

# Simulate API calls
node scripts/debugging/debug-github-actions-errors.js --simulate
```

## 📊 Common Issues

### GitHub Actions
| Issue | Debug Command | Solution |
|-------|---------------|----------|
| Rate limit | `debug-github-actions-errors.js --check-rate-limit` | Reduce API calls |
| Timeout | `debug-github-actions-errors.js --analyze-duration` | Optimize queries |
| Auth failure | `debug-github-actions-errors.js --test-auth` | Check tokens |

### Data Capture
| Issue | Debug Command | Solution |
|-------|---------------|----------|
| Missing PRs | `debug-capture-pr.mjs --check-missing` | Run backfill |
| Sync errors | `debug-capture-pr.mjs --trace` | Check API response |
| Duplicate data | `debug-capture-pr.mjs --check-duplicates` | Fix upsert logic |

## 🔧 Debug Configuration

### Environment Variables
```bash
# Enable debug mode
DEBUG=true
LOG_LEVEL=debug
VERBOSE=true

# Specific debugging
DEBUG_GITHUB_ACTIONS=true
DEBUG_UI_EVENTS=true
DEBUG_DATA_CAPTURE=true
```

### Debug Flags
```javascript
{
  logLevel: "debug",
  captureErrors: true,
  recordTimings: true,
  saveDebugOutput: true,
  outputPath: "./debug-logs/"
}
```

## 📝 Debug Reports

### Automated Reports
Scripts generate detailed reports:
- `./debug-logs/github-actions-{timestamp}.json`
- `./debug-logs/ui-events-{timestamp}.json`
- `./debug-logs/data-capture-{timestamp}.json`

### Report Contents
```json
{
  "timestamp": "2024-03-15T10:23:45Z",
  "issue": "Rate limit exceeded",
  "context": {
    "workflow": "Progressive Backfill",
    "repository": "pytorch/pytorch",
    "step": "chunk-42"
  },
  "metrics": {
    "apiCalls": 5000,
    "duration": "2m 34s",
    "memoryUsage": "256MB"
  },
  "suggestions": [
    "Reduce chunk size to 10",
    "Add 60s delay between chunks",
    "Use GraphQL for batch operations"
  ]
}
```

## 🚨 Debug Alerts

### Critical Issues
Scripts can send alerts for:
- Repeated failures (>3 in 1 hour)
- Performance degradation (>50% slower)
- Data inconsistencies
- Security issues

## 🔄 Local Development

### Inngest Debugging
```bash
# Reset local Inngest
./scripts/debugging/fix-inngest-local.sh

# Start with UI
./scripts/debugging/start-inngest-local.sh --dev-ui

# View event flow
open http://localhost:8288
```

### Build Debugging
```bash
# Check for build issues
node scripts/debugging/check-build-clean.js

# Analyze bundle problems
node scripts/debugging/check-build-clean.js --analyze-bundle
```

## 🆘 Quick Fixes

### "Inngest not working locally"
```bash
./scripts/debugging/fix-inngest-local.sh
npm run dev:inngest
```

### "UI events not firing"
```bash
node scripts/debugging/debug-ui-events.js --reset-listeners
```

### "Data capture stuck"
```bash
node scripts/debugging/debug-capture-pr.mjs --force-reset
```

## 📚 Best Practices

1. **Always dry-run first**: Test fixes before applying
2. **Save debug logs**: Keep for pattern analysis
3. **Check related systems**: Issues often cascade
4. **Document findings**: Update troubleshooting guide
5. **Monitor after fixes**: Ensure issues don't recur