# RLS Policy Quick Reference Card

## 🚨 STOP Before Creating a New Policy!

### 1️⃣ Check Existing Policies
```sql
SELECT polname, polcmd, polpermissive, polqual::text
FROM pg_policies
WHERE tablename = 'YOUR_TABLE_NAME';
```

### 2️⃣ Can You Consolidate?
If you see multiple permissive policies for the same operation, **CONSOLIDATE THEM**:

```sql
-- ❌ WRONG: Multiple policies
CREATE POLICY "policy1" ON table FOR SELECT USING (condition1);
CREATE POLICY "policy2" ON table FOR SELECT USING (condition2);

-- ✅ RIGHT: Single consolidated policy
CREATE POLICY "consolidated_read" ON table FOR SELECT
USING (condition1 OR condition2);
```

## Common Patterns

### Public + Authenticated Access
```sql
CREATE POLICY "public_and_auth_read" ON table FOR SELECT
USING (
  true  -- public access
  OR auth.uid() IS NOT NULL  -- authenticated users
);
```

### Owner + Admin Access
```sql
CREATE POLICY "owner_or_admin_write" ON table
FOR UPDATE
USING (
  user_id = auth.uid()  -- owner
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### Workspace Member Access
```sql
CREATE POLICY "workspace_member_access" ON table FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

## Performance Impact

| Policies | Evaluation Time | Memory Usage |
|----------|----------------|--------------|
| 1 policy | 1x | 1x |
| 2 policies | 2.1x | 2.2x |
| 3 policies | 3.5x | 3.8x |
| 5+ policies | 6x+ | 7x+ |

**Every additional permissive policy multiplies overhead!**

## Quick Audit Command
```bash
# Find tables with duplicate permissive policies
psql $DATABASE_URL -c "
  SELECT tablename, COUNT(*) as duplicate_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND polpermissive = true
  GROUP BY tablename, polcmd
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
"
```

## Remember
- **91 policies were consolidated in PR #818**
- **30-40% performance improvement** from consolidation
- **Always check before creating**
- **Consolidate when possible**
- **Document your policies**

## Need Help?
- Full documentation: [`/docs/database/rls-policy-consolidation-lessons.md`](./rls-policy-consolidation-lessons.md)
- Performance guide: [`/docs/database/rls-performance-optimization.md`](./rls-performance-optimization.md)
- Supabase Dashboard: Check Security Advisor for policy warnings