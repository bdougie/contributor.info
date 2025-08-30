# Secure Migration to pull_request_target

## Overview

This document explains the secure migration from `pull_request` to `pull_request_target` event in our PR compliance workflow, addressing security concerns while enabling proper functionality for forked PRs.

## Why pull_request_target?

### Benefits
1. **Fork Support**: Allows workflows to run with write permissions for PRs from forks
2. **Secret Access**: Enables commenting on PRs and using GitHub tokens
3. **Label Management**: Can add/remove labels on PRs from forks
4. **Status Checks**: Can post check results visible in PR UI

### Security Risks
1. **Code Injection**: Malicious PR code could access secrets if not properly isolated
2. **Token Exfiltration**: GitHub tokens could be stolen if exposed to untrusted code
3. **Resource Abuse**: Malicious code could consume excessive CI resources

## Security Architecture

### Key Principle: Separation of Concerns

The secure implementation separates untrusted and trusted operations into different jobs:

```yaml
┌─────────────────────────────────────────────┐
│           pull_request_target               │
├─────────────────────────────────────────────┤
│                                             │
│  Job 1: code-checks (UNTRUSTED)            │
│  - Checks out PR code                      │
│  - NO secrets access                       │
│  - Runs all validation                     │
│  - Outputs results to artifacts            │
│                                             │
│  Job 2: comment-results (TRUSTED)          │
│  - Checks out BASE branch code             │
│  - HAS secrets access                      │
│  - Only reads artifacts                    │
│  - Posts comments using secrets            │
│                                             │
│  Job 3: pr-labels (TRUSTED)                │
│  - Checks out BASE branch code             │
│  - HAS secrets access                      │
│  - Manages labels using config from base   │
│                                             │
└─────────────────────────────────────────────┘
```

## Security Controls

### 1. Checkout Isolation

**Untrusted Code Checkout:**
```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.head.sha }}
    persist-credentials: false  # Disable token persistence
```

**Trusted Code Checkout:**
```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.base.ref }}
```

### 2. Secret Protection

- **No secrets** in jobs that checkout PR code
- Secrets **only** available to jobs checking out base branch
- Results passed via artifacts, not environment variables

### 3. Permission Scoping

Each job explicitly declares minimal permissions:
```yaml
permissions:
  pull-requests: write  # Only for commenting jobs
  contents: read        # Read-only access
  security-events: write # Only for CodeQL
```

### 4. Input Validation

- No direct use of PR title/body in scripts
- All user inputs sanitized before use
- Results stored as structured JSON

## Implementation Checklist

### ✅ Safe Practices

1. **Separate Jobs**: Untrusted code runs in isolation
2. **No Secret Exposure**: PR code never has access to secrets
3. **Artifact Communication**: Results passed via artifacts
4. **Base Branch Scripts**: Only trusted code executes with secrets
5. **Explicit Permissions**: Each job declares minimal permissions
6. **Concurrency Control**: Prevents resource abuse

### ❌ Unsafe Patterns to Avoid

```yaml
# NEVER DO THIS - Exposes secrets to PR code
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.head.sha }}
- run: echo ${{ secrets.GITHUB_TOKEN }} # EXPOSED!

# NEVER DO THIS - Executes PR code with secrets
- run: |
    npm install
    npm run some-script # Could be malicious!
  env:
    TOKEN: ${{ secrets.GITHUB_TOKEN }}

# NEVER DO THIS - Uses PR data in scripts unsafely
- run: |
    echo "${{ github.event.pull_request.title }}" # Could contain injections
```

## Testing the Implementation

### 1. Test with Fork PR
```bash
# From a fork
git checkout -b test-fork-pr
echo "test" >> README.md
git commit -am "test: fork PR"
git push origin test-fork-pr
# Create PR from fork to main repo
```

### 2. Test Malicious Patterns
Create a PR with:
- Malicious commit messages
- Large files to test resource limits
- Modified workflow files (should be ignored)

### 3. Verify Security Controls
- Confirm no secrets in PR code job logs
- Verify comments post successfully
- Check that labels are applied correctly

## Monitoring and Alerts

### What to Monitor
1. **Workflow Run Time**: Alert if >15 minutes
2. **Artifact Size**: Alert if >100MB
3. **Failed Comments**: May indicate token issues
4. **Concurrent Runs**: Should be limited by concurrency group

### Security Indicators
- Look for base64 encoded strings in logs
- Monitor for excessive API calls
- Check for unexpected network requests

## Migration Steps

1. **Backup Current Workflow**: Save existing `compliance.yml`
2. **Deploy New Workflow**: Add `compliance-secure.yml`
3. **Test with Internal PR**: Verify all checks work
4. **Test with Fork PR**: Confirm fork support works
5. **Update Branch Protection**: Point to new workflow checks
6. **Remove Old Workflow**: After verification period

## Rollback Plan

If security issues are detected:

1. **Immediate**: Disable workflow via GitHub UI
2. **Revert**: Switch back to `pull_request` event
3. **Investigate**: Review logs for security incidents
4. **Report**: Document any security events

## Compliance

This implementation follows:
- GitHub Security Best Practices
- OWASP Secure Coding Guidelines
- Principle of Least Privilege
- Defense in Depth

## References

- [GitHub Docs: pull_request_target](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request_target)
- [Security Hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Keeping your GitHub Actions and workflows secure](https://securitylab.github.com/research/github-actions-preventing-pwn-requests/)

## Contact

For security concerns or questions about this implementation:
- Open a security advisory
- Contact the maintainers directly
- Use the security@[domain] email