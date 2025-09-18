# Database Trigger Troubleshooting

## Common Trigger Issues

### update_last_updated_column() Field Mismatch

**Issue**: The `update_last_updated_column()` trigger fails with "record has no field" error.

**Root Cause**: Mismatch between the field name in the trigger function and the actual column name in the table.

**Example Error**:
```
record "new" has no field "last_updated"
CONTEXT: PL/pgSQL assignment "NEW.last_updated = NOW()"
PL/pgSQL function update_last_updated_column() line 3 at assignment
```

## Solution Approach

### 1. Verify Column Names
Check the actual column name in your table:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'your_table_name'
  AND column_name LIKE '%last_updated%';
```

### 2. Check Trigger Status
Verify if triggers are enabled:
```sql
SELECT
    tgname AS trigger_name,
    CASE tgenabled
        WHEN 'O' THEN 'DISABLED'
        WHEN 'A' THEN 'ALWAYS ENABLED'
        ELSE 'ENABLED'
    END as status
FROM pg_trigger
WHERE tgrelid = 'your_table_name'::regclass;
```

### 3. Fix Approach
The migration `20250918_enable_pr_trigger.sql` demonstrates the fix:
1. Drop and recreate the trigger to ensure proper attachment
2. Test the trigger works despite status flags
3. Update existing NULL values for consistency

## Testing Triggers

Test if a trigger is working:
```sql
-- Update a row and check if the timestamp changes
UPDATE your_table
SET some_field = some_field
WHERE id = (SELECT id FROM your_table LIMIT 1)
RETURNING id, last_updated;
```

## Important Notes

- **Supabase Quirk**: Triggers may show as "DISABLED" in status but still function correctly
- **Testing**: Always test trigger functionality with actual updates rather than relying on status flags
- **Migrations**: Use migrations to ensure triggers are consistently applied across environments

## Related Files
- `/supabase/migrations/20250917_fix_pr_trigger_last_updated.sql` - Adds missing column
- `/supabase/migrations/20250918_enable_pr_trigger.sql` - Ensures trigger is active