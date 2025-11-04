# Data and Schema Migrations

This folder documents major data and schema migrations that affect system behavior, user experience, or data structures in the contributor.info application.

## Contents

### System Migrations

- **[2025-08-smart-throttling.md](./2025-08-smart-throttling.md)** - Implementation of smart throttling system with data completeness detection and context-aware cooldown periods to improve first-visit user experience
- **[2025-10-workspace-user-relations-fix.md](./2025-10-workspace-user-relations-fix.md)** - Fix for workspace user relations data model

## Purpose

This directory documents:
- Major behavioral changes to the system
- Schema migrations that impact multiple features
- Data transformation procedures
- Breaking changes and compatibility notes
- Rollback procedures for failed migrations

## Migration Documentation Guidelines

Each migration document should include:

1. **Problem Statement** - What issue prompted the migration
2. **Solution** - What changes were made
3. **Changes Made** - Specific files and code modifications
4. **Breaking Changes** - Any incompatibilities introduced
5. **Migration Steps** - How to apply the migration
6. **Rollback Plan** - How to revert if needed
7. **Success Metrics** - How to verify the migration worked
8. **Performance Impact** - Database and API impact analysis
9. **Lessons Learned** - Key takeaways from the migration

## Types of Migrations

### Schema Migrations
Database structure changes managed through Supabase migrations:
```bash
supabase migration up <migration-name>
```

### Data Migrations
Transformations of existing data without schema changes:
```sql
UPDATE table SET new_field = calculated_value;
```

### Behavioral Migrations
Changes to system behavior without schema modifications, like the smart throttling system.

## Best Practices

1. **Test migrations in development first**
2. **Create rollback scripts before deploying**
3. **Document breaking changes clearly**
4. **Measure performance impact**
5. **Monitor error rates after deployment**
6. **Keep migration documentation updated**

## Related Documentation

- [Database](../database/) - Database schema and RLS policies
- [Supabase Migrations](../../supabase/migrations/) - Actual migration SQL files
- [Postmortems](../postmortems/) - Issues discovered during migrations
- [Architecture](../architecture/) - System architecture documentation
