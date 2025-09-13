# PostHog Management Scripts

This directory contains scripts for managing PostHog cohorts and feature flags.

## ⚠️ Security Note

**NEVER commit API keys or secrets to the repository!** All sensitive values must be stored in environment variables.

## Setup

1. **Create a `.env` file** in the project root (if it doesn't exist)
2. **Add required environment variables**:

```bash
# Required for all PostHog scripts
POSTHOG_PROJECT_ID=your-project-id
POSTHOG_PERSONAL_API_KEY=phx_your-personal-api-key

# Required for feature flag scripts that target cohorts
POSTHOG_INTERNAL_TEAM_COHORT_ID=cohort-id-from-script-output
```

3. **Get your values**:
   - **Project ID**: Found in PostHog settings
   - **Personal API Key**: Generate from PostHog > Account > Personal API Keys
   - **Cohort IDs**: Run cohort creation scripts first, note the IDs from output

## Available Scripts

### Cohort Management

#### `create-internal-users-cohort.js`
Creates or updates the Internal Team cohort for testing and development.

```bash
node scripts/create-internal-users-cohort.js
```

To add team members, edit the `INTERNAL_USERS` array in the script.

#### `create-posthog-cohorts-simple.js`
Creates property-based cohorts (e.g., users with workspaces, active users).

```bash
node scripts/create-posthog-cohorts-simple.js
```

### Feature Flag Management

#### `create-workspace-feature-flag.js`
Creates or updates the workspace creation feature flag.

```bash
# First, ensure POSTHOG_INTERNAL_TEAM_COHORT_ID is set in .env
node scripts/create-workspace-feature-flag.js
```

## Workflow

1. **Create cohorts first**:
   ```bash
   node scripts/create-internal-users-cohort.js
   # Note the cohort ID from output (e.g., 180246)
   ```

2. **Add cohort ID to .env**:
   ```bash
   POSTHOG_INTERNAL_TEAM_COHORT_ID=180246
   ```

3. **Create feature flags**:
   ```bash
   node scripts/create-workspace-feature-flag.js
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "POSTHOG_PERSONAL_API_KEY not found" | Add the key to your `.env` file |
| "Failed to create cohort: Forbidden" | Check API key permissions in PostHog |
| "POSTHOG_INTERNAL_TEAM_COHORT_ID not set" | Run cohort script first, add ID to `.env` |
| "Invalid project ID" | Verify POSTHOG_PROJECT_ID matches your PostHog project |

## Best Practices

1. **Never hardcode IDs or keys** - Always use environment variables
2. **Run cohort scripts before feature flags** - Feature flags need cohort IDs
3. **Document cohort IDs** - Keep track of cohort IDs for your environment
4. **Use descriptive names** - Make cohort and flag names self-documenting
5. **Test locally first** - Verify scripts work before deploying

## Security Checklist

- [ ] No API keys in code
- [ ] No hardcoded cohort IDs
- [ ] `.env` file is in `.gitignore`
- [ ] Environment variables documented in `.env.example`
- [ ] Sensitive values never logged to console