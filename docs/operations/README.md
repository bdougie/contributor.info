# Operational Procedures

This folder contains operational procedures, runbooks, and day-to-day maintenance guides for running the contributor.info application.

## Contents

### Workspace Operations

- **[workspace-sync-operations.md](./workspace-sync-operations.md)** - Comprehensive guide for deploying, operating, and maintaining workspace sync operations including health checks, manual syncs, and emergency procedures

## Purpose

This directory provides:
- Deployment procedures
- Daily operational tasks
- Troubleshooting runbooks
- Emergency response procedures
- Maintenance schedules
- Monitoring and alerting guides

## Target Audience

This documentation is for:
- DevOps engineers
- Site reliability engineers
- On-call responders
- System administrators
- Technical operations staff

## Document Categories

### Deployment Procedures
Step-by-step guides for deploying features and updates to production.

### Daily Operations
Routine tasks like:
- Health checks
- Performance monitoring
- Sync status verification
- Error rate tracking

### Weekly Maintenance
Regular maintenance tasks:
- Performance audits
- Data cleanup
- Sync frequency optimization

### Monthly Tasks
- Tier reviews
- Cost analysis
- Performance baseline updates

### Emergency Procedures
Critical response guides:
- Stop all syncs
- Rate limit emergencies
- Rollback procedures
- Incident response

## Workspace Sync Operations

### Quick Start Deployment
1. Deploy database changes
2. Link existing workspaces
3. Deploy Edge Functions
4. Set environment variables
5. Test deployment

### Daily Health Check
```bash
# Check sync status
psql $DATABASE_URL -c "SELECT COUNT(*) as total_workspaces..."
```

### Manual Sync Operations
```bash
# Sync specific workspace
curl -X POST "${SUPABASE_URL}/functions/v1/workspace-issues-sync"...
```

## Best Practices

1. **Document as you go** - Update procedures during incidents
2. **Test in staging** - Verify procedures before production use
3. **Include rollback steps** - Always have a way back
4. **Monitor after changes** - Watch metrics post-deployment
5. **Keep runbooks updated** - Review and update quarterly

## Monitoring and Alerts

### Key Metrics
- Query performance for workspace aggregations
- Cache hit rates
- User engagement metrics
- Data freshness

### Alert Thresholds
- Slow queries (>5s)
- High error rates
- Failed sync attempts
- Resource exhaustion

## Emergency Contacts

For urgent operational issues:
- Check Supabase status page
- Review GitHub API status
- Check Edge Function logs
- Create urgent GitHub issue

## Related Documentation

- [Deployment](../deployment/) - Deployment guides
- [Infrastructure](../infrastructure/) - Infrastructure setup
- [Monitoring](../testing/performance-monitoring.md) - Performance monitoring
- [Troubleshooting](../troubleshooting/) - Issue debugging
