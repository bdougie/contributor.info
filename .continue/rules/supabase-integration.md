# Supabase Integration Standards

## Migrations

- **Always use Supabase MCP server** for applying migrations
- Never apply migrations manually through scripts
- Test migrations in development first
- Document migration purpose and impact

## Edge Functions

- **Edge functions must be manually deployed** when updated
- Don't assume automatic deployment
- Test edge functions locally before deploying
- Document deployment steps

## Database Access

- Use proper RLS (Row Level Security) policies
- Follow patterns in `supabase/apply-rls-policies.sql`
- Reference `supabase/IMPLEMENTATION_GUIDE.md` for setup
- Check `supabase/QUICK_REFERENCE.md` for common queries

## Environment Configuration

Required environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never commit these values!

## Key Files

- `supabase/migrations/` - Database schema migrations
- `supabase/apply-rls-policies.sql` - Row Level Security
- `supabase/IMPLEMENTATION_GUIDE.md` - Setup documentation
- `src/lib/supabase.ts` - Client configuration

## Review Checklist

- [ ] Migrations use MCP server
- [ ] Edge function deployment documented
- [ ] RLS policies properly configured
- [ ] Environment variables not committed
- [ ] Supabase client properly configured
- [ ] Database queries follow best practices
