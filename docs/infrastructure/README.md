# Infrastructure Setup and Configuration

This folder contains documentation for infrastructure components, deployment architectures, and system configuration.

## Contents

### Security

- **[content-security-policy.md](./content-security-policy.md)** - Content Security Policy configuration

### Inngest Architecture

- **[dual-inngest-architecture.md](./dual-inngest-architecture.md)** - Dual Inngest instance architecture
- **[hybrid-job-processing.md](./hybrid-job-processing.md)** - Hybrid job processing system
- **[idempotency-implementation.md](./idempotency-implementation.md)** - Idempotency for job processing
- **[inngest-pipeline-validation.md](./inngest-pipeline-validation.md)** - Pipeline validation
- **[inngest-supabase-migration.md](./inngest-supabase-migration.md)** - Migration to Supabase Edge Functions
- **[queue-event-migration.md](./queue-event-migration.md)** - Queue event system migration
- **[testing-inngest-supabase.md](./testing-inngest-supabase.md)** - Testing Inngest with Supabase

### Edge Functions

- **[edge-function-scaling-strategy.md](./edge-function-scaling-strategy.md)** - Scaling strategy for Edge Functions
- **[supabase-edge-function-secrets.md](./supabase-edge-function-secrets.md)** - Managing Edge Function secrets
- **[supabase-edge-functions-deployment.md](./supabase-edge-functions-deployment.md)** - Deployment procedures
- **[supabase-edge-functions.md](./supabase-edge-functions.md)** - Edge Functions overview

### Workspace Integration

- **[codeowners-workspace-sync-supabase-migration.md](./codeowners-workspace-sync-supabase-migration.md)** - CODEOWNERS workspace sync migration

### Netlify Functions

- **[netlify-env-var-cleanup.md](./netlify-env-var-cleanup.md)** - Environment variable cleanup
- **[netlify-functions-directory-fix.md](./netlify-functions-directory-fix.md)** - Functions directory configuration
- **[netlify-redirects.md](./netlify-redirects.md)** - Netlify redirect rules

### Migration and Scaling

- **[fly-webhook-migration.md](./fly-webhook-migration.md)** - Webhook migration to Fly.io
- **[gh-datapipe-backfill-500-diagnostic.md](./gh-datapipe-backfill-500-diagnostic.md)** - GitHub Data Pipeline diagnostics

## Purpose

This directory documents:
- Infrastructure components and architecture
- Deployment configurations
- Scaling strategies
- Migration procedures
- Security configurations
- Performance optimizations

## Infrastructure Overview

### Hosting and Deployment

#### Frontend
- **Platform**: Netlify
- **Domain**: contributor.info
- **CDN**: Netlify CDN (global)
- **Build**: Vite + React
- **Deploy**: Automatic on main branch push

#### Database
- **Platform**: Supabase
- **Database**: PostgreSQL 15
- **Features**: RLS, Edge Functions, Auth, Real-time
- **Region**: Configurable

#### Background Jobs
- **Platform**: Inngest
- **Functions**: Event-driven workflows
- **Hosting**: Netlify Functions + Supabase Edge Functions
- **Queue**: Redis-based

#### Webhooks
- **Platform**: Fly.io
- **Purpose**: GitHub webhook handling
- **Scaling**: Auto-scale based on load

### Architecture Patterns

#### Dual Inngest Architecture
- Production instance on Netlify Functions
- Fallback instance on Supabase Edge Functions
- Automatic failover
- Load distribution

#### Hybrid Job Processing
- Fast jobs on Netlify Functions
- Long-running jobs on Edge Functions
- Job type routing
- Resource optimization

#### Idempotency
- Job deduplication
- Retry safety
- State management
- Conflict resolution

## Security Configuration

### Content Security Policy
Strict CSP headers for XSS protection:
```
default-src 'self';
script-src 'self' 'unsafe-inline' trusted-domains;
connect-src 'self' api-domains;
```

### API Key Management
- Environment variables for all keys
- Secrets stored in platform vaults
- Rotation procedures
- Access audit logs

### Authentication
- GitHub OAuth for users
- Service role keys for backend
- JWT tokens for sessions
- API key authentication for integrations

## Scaling Strategies

### Edge Function Scaling
- Auto-scale based on requests
- Cold start optimization
- Regional deployment
- Warm-up strategies

### Database Scaling
- Connection pooling
- Read replicas (future)
- Query optimization
- Table partitioning

### Background Job Scaling
- Job prioritization
- Queue management
- Parallel processing
- Resource limits

## Deployment Architecture

### Production
```
GitHub → Netlify (Frontend)
       → Supabase (Database + Edge Functions)
       → Inngest (Background Jobs)
       → Fly.io (Webhooks)
```

### Staging
```
GitHub PR → Netlify Deploy Preview
          → Supabase Preview Branch
          → Inngest Dev Environment
```

## Migration Procedures

### Webhook Migration to Fly.io
1. Deploy webhook handler to Fly.io
2. Update GitHub webhook URLs
3. Verify webhook delivery
4. Remove old handlers

### Inngest to Supabase Migration
1. Deploy Edge Functions
2. Update event routing
3. Test job execution
4. Switch traffic gradually
5. Monitor performance

## Monitoring and Alerts

### Infrastructure Monitoring
- Uptime monitoring (Pingdom/UptimeRobot)
- Error tracking (Sentry)
- Performance monitoring (Netlify Analytics)
- Database metrics (Supabase Dashboard)
- Job queue metrics (Inngest Dashboard)

### Alert Thresholds
- **Critical**: Service unavailable, database down
- **High**: Error rate > 5%, slow queries
- **Medium**: High resource usage, queue backlog
- **Low**: Deployment notifications, scaling events

## Cost Optimization

### Netlify
- Build minute optimization
- Bandwidth monitoring
- Function execution tracking

### Supabase
- Connection pooling
- Query optimization
- Storage management
- Edge Function optimization

### Inngest
- Job batching
- Retry strategy optimization
- Queue prioritization

## Disaster Recovery

### Backup Strategy
- Database: Automated daily backups
- Secrets: Stored in 1Password
- Configuration: Version controlled
- Deployment: Git-based rollback

### Recovery Procedures
1. Identify scope of issue
2. Execute rollback procedure
3. Restore from backup if needed
4. Verify service restoration
5. Post-mortem analysis

## Related Documentation

- [Deployment](../deployment/) - Deployment procedures
- [Operations](../operations/) - Operational procedures
- [Edge Functions](../edge-functions/) - Edge Function documentation
- [Architecture](../architecture/) - System architecture
