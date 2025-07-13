# Troubleshooting GitHub Actions Errors

## Problem Summary

GitHub Actions workflows are completing successfully but producing a 100% error rate because:
1. Workflows succeed at the GitHub level but store errors as artifacts
2. The actual data processing is failing within the workflow
3. Errors are not being properly propagated to fail the workflow

## Common Issues and Solutions

### 1. Authentication Errors

**Issue**: The workflow cannot authenticate with GitHub or Supabase APIs.

**Solution**:
- Ensure `GITHUB_TOKEN` is set in the jobs repository secrets
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured
- Check that the GitHub App has proper permissions

### 2. Missing Dependencies

**Issue**: CLI scripts in the jobs repository fail due to missing npm packages.

**Solution**:
```yaml
# In the workflow file, ensure dependencies are installed:
- name: Install dependencies
  run: npm ci
```

### 3. Incorrect Error Handling

**Issue**: Workflows succeed even when the actual processing fails.

**Solution**: Update workflow files to properly fail on errors:

```yaml
- name: Run historical sync
  run: |
    node scripts/historical-pr-sync.js || exit 1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Repository Access Issues

**Issue**: The workflow cannot access the target repository data.

**Solution**:
- Verify the repository IDs and names being passed
- Check that repositories exist in the database
- Ensure proper GitHub App installation on target repos

## Debugging Steps

### 1. Check Workflow Logs
```bash
# View recent workflow runs
gh run list --repo bdougie/jobs --limit 10

# View specific run details
gh run view <run-id> --repo bdougie/jobs --log
```

### 2. Download Error Artifacts
```bash
# List artifacts for a run
gh run download <run-id> --repo bdougie/jobs

# Check error logs in the artifact
cat rollout-metrics-*/error.log
```

### 3. Test Locally
```bash
# Clone the jobs repository
git clone https://github.com/bdougie/jobs.git
cd jobs

# Install dependencies
npm install

# Test a script locally with test data
GITHUB_TOKEN=<token> \
SUPABASE_URL=<url> \
SUPABASE_SERVICE_KEY=<key> \
node scripts/historical-pr-sync.js \
  --repository-id <uuid> \
  --repository-name "owner/repo" \
  --time-range 7
```

### 4. Update Workflow Error Handling

Example of proper error handling in workflow:

```yaml
name: Historical PR Sync
on:
  workflow_dispatch:
    inputs:
      repository_id:
        description: 'Repository UUID'
        required: true
      repository_name:
        description: 'Repository name (owner/repo)'
        required: true

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run sync with error handling
        run: |
          set -e  # Exit on error
          node scripts/historical-pr-sync.js \
            --repository-id "${{ inputs.repository_id }}" \
            --repository-name "${{ inputs.repository_name }}" \
            --time-range 30 \
            --max-items 100
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          
      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: error-logs-${{ github.run_id }}
          path: |
            *.log
            error-*.json
```

## Quick Fixes

### 1. Update Job Status Reporting

The GitHub Actions workflow should update the job status in the database:

```javascript
// In the CLI script
async function updateJobStatus(jobId, status, error = null) {
  await supabase
    .from('progressive_capture_jobs')
    .update({
      status,
      error,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

// On success
await updateJobStatus(jobId, 'completed');

// On failure
await updateJobStatus(jobId, 'failed', error.message);
```

### 2. Add Health Checks

Add a health check at the beginning of each script:

```javascript
// Check required environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Test database connection
try {
  const { error } = await supabase.from('repositories').select('id').limit(1);
  if (error) throw error;
} catch (error) {
  console.error('Database connection failed:', error);
  process.exit(1);
}
```

## Monitoring

Use these commands to monitor the system:

```javascript
// In browser console
HybridMonitoring.getJobErrors()  // See recent errors
HybridMonitoring.generateReport() // Full system report
rollout.checkHealth()            // Check system health
```

## Next Steps

1. **Update workflows** in bdougie/jobs repository with proper error handling
2. **Add health checks** to all CLI scripts
3. **Implement job status updates** from within the workflows
4. **Test with a small repository** before enabling for all repos
5. **Monitor error artifacts** to identify specific failure patterns