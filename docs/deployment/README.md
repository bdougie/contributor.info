# Deployment Procedures

This folder contains deployment guides, procedures, and configuration documentation for deploying contributor.info to production and staging environments.

## Contents

### Inngest Deployment

- **[inngest-webhook-update.md](./inngest-webhook-update.md)** - Guide for updating Inngest webhook configuration

## Purpose

This directory documents:
- Deployment procedures
- Environment configuration
- Release processes
- Rollback procedures
- Post-deployment verification
- Troubleshooting deployment issues

## Deployment Targets

### Production
- **Frontend**: Netlify (contributor.info)
- **Database**: Supabase (hosted PostgreSQL)
- **Edge Functions**: Supabase Edge Functions
- **Background Jobs**: Inngest
- **Webhooks**: Fly.io

### Staging
- **Frontend**: Netlify deploy previews
- **Database**: Supabase preview branches
- **Edge Functions**: Supabase staging project

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review approved
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured

### Deployment Steps
1. **Database Migrations**: Apply via Supabase CLI
2. **Edge Functions**: Deploy updated functions
3. **Environment Variables**: Set new secrets
4. **Frontend**: Deploy via Netlify
5. **Background Jobs**: Update Inngest functions

### Post-Deployment
- [ ] Verify health checks pass
- [ ] Check error rates in Sentry
- [ ] Monitor performance metrics
- [ ] Test critical user flows
- [ ] Verify background jobs running
- [ ] Check webhook delivery

## Environment Configuration

### Required Environment Variables

#### Frontend (Netlify)
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_GITHUB_CLIENT_ID=xxx
VITE_POSTHOG_KEY=xxx
```

#### Edge Functions (Supabase)
```bash
GITHUB_TOKEN=xxx
OPENAI_API_KEY=xxx
INNGEST_SIGNING_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

#### Background Jobs (Inngest)
```bash
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx
```

### Setting Secrets

#### Supabase Secrets
```bash
supabase secrets set OPENAI_API_KEY="xxx" \
  --project-ref your-project-ref
```

#### Netlify Environment Variables
Set via Netlify Dashboard: Site settings → Environment variables

#### Inngest Configuration
Set via Inngest Dashboard: Project → Settings → Environment

## Deployment Types

### Standard Deployment
Regular feature releases following main branch merge.

### Hotfix Deployment
Critical bug fixes deployed outside regular cycle:
1. Create hotfix branch
2. Apply minimal fix
3. Fast-track review
4. Deploy immediately
5. Merge back to main

### Database Migration
Schema changes requiring migration:
1. Test migration locally
2. Backup production database
3. Apply migration
4. Verify data integrity
5. Deploy code changes

### Edge Function Update
Supabase Edge Function changes:
```bash
supabase functions deploy function-name \
  --project-ref your-project-ref
```

## Rollback Procedures

### Frontend Rollback
Via Netlify dashboard:
1. Go to Deploys
2. Find previous working deploy
3. Click "Publish deploy"

### Database Rollback
```bash
# Revert last migration
supabase migration down

# Or restore from backup
supabase db restore backup-file
```

### Edge Function Rollback
Redeploy previous version from Git history.

## Monitoring Post-Deployment

### Key Metrics
- Error rates (Sentry)
- Response times (Netlify Analytics)
- Database performance (Supabase Dashboard)
- Background job success rate (Inngest)
- API rate limits (GitHub)

### Health Checks
```bash
# Frontend health
curl https://contributor.info/.netlify/functions/health-check

# Database connection
psql $DATABASE_URL -c "SELECT 1"

# Edge function
curl https://xxx.supabase.co/functions/v1/function-name
```

## Troubleshooting

### Deployment Fails
1. Check build logs
2. Verify environment variables
3. Test migrations locally
4. Review dependencies

### 500 Errors After Deploy
1. Check Sentry for errors
2. Review Edge Function logs
3. Verify database connectivity
4. Check API integrations

### Background Jobs Not Running
1. Verify Inngest webhook configuration
2. Check signing keys
3. Review job logs
4. Test event delivery

## Related Documentation

- [Infrastructure](../infrastructure/) - Infrastructure setup
- [Operations](../operations/) - Operational procedures
- [Testing](../testing/) - Testing procedures
- [Troubleshooting](../troubleshooting/) - Debugging guides
