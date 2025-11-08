# Quick Fix: Netlify 4KB Environment Variable Limit

## Immediate Action Required

Your Netlify deployment is failing because environment variables exceed AWS Lambda's 4KB limit.

## 🚀 Quick Fix (5 minutes)

Go to: **Netlify Dashboard → Site Settings → Build & deploy → Environment variables**

### Phase 1: Remove VITE_* Variables (Saves ~2-3KB)

Delete these 20 variables - they're already baked into your build:

```
☐ VITE_SUPABASE_URL
☐ VITE_SUPABASE_ANON_KEY
☐ VITE_SUPABASE_DATABASE_URL
☐ VITE_ENV
☐ VITE_INNGEST_APP_ID
☐ VITE_OPENAI_API_KEY
☐ VITE_POSTHOG_KEY
☐ VITE_POSTHOG_HOST
☐ VITE_SENTRY_DSN
☐ VITE_DUB_CO_KEY
☐ VITE_DUB_DOMAIN_DEV
☐ VITE_DUB_DOMAIN_PROD
☐ VITE_POLAR_ACCESS_TOKEN
☐ VITE_POLAR_PRODUCT_ID_PRO
☐ VITE_POLAR_PRODUCT_ID_TEAM
☐ VITE_POLAR_ENVIRONMENT
☐ VITE_SLACK_WEBHOOK_ENCRYPTION_KEY
☐ VITE_SLACK_CLIENT_ID
☐ VITE_SLACK_REDIRECT_URI
☐ VITE_POLAR_WEBHOOK_SECRET
```

**Why safe?** Vite processes these at build time. They're already in your JavaScript bundle. Lambda functions don't need them.

### Phase 2: Remove Unused Variables (If Phase 1 isn't enough)

Delete these if they exist:

```
☐ SUPABASE_MCP_TOKEN
☐ SUPABASE_DB_PASSWORD
☐ INNGEST_SERVE_HOST
☐ INNGEST_SERVE_PATH
☐ INNGEST_LOCAL_SIGNING_KEY
☐ INNGEST_DEV
☐ POSTHOG_PROJECT_ID
☐ CHROMATIC_PROJECT_TOKEN
☐ STORYBOOK_NETLIFY_SITE_ID
☐ MAIN_NETLIFY_SITE_ID
☐ FLY_API_TOKEN
```

### Phase 3: Deploy

After cleanup:
```bash
git push origin explore-slack-integration-workspaces
```

Netlify will auto-deploy and functions should now upload successfully.

## ✅ What to Keep

**DO NOT DELETE** these - your functions need them:

```
✓ SUPABASE_SERVICE_ROLE_KEY
✓ SUPABASE_TOKEN
✓ GITHUB_TOKEN
✓ INNGEST_EVENT_KEY
✓ INNGEST_SIGNING_KEY
✓ INNGEST_PRODUCTION_EVENT_KEY
✓ INNGEST_PRODUCTION_SIGNING_KEY
✓ SLACK_CLIENT_ID
✓ SLACK_CLIENT_SECRET
✓ POLAR_ACCESS_TOKEN
✓ POLAR_WEBHOOK_SECRET
✓ DUB_CO_KEY
✓ ADMIN_KEY
```

## 📊 Expected Results

- **Before**: ~5KB of env vars (over limit)
- **After Phase 1**: ~2.5KB (under limit) ✅
- **Deployment**: Should succeed

## ❓ FAQ

**Q: Will removing VITE_* variables break my app?**
A: No. They're already compiled into your JavaScript bundle during build.

**Q: How do I know it worked?**
A: Next deploy will show "✓ All functions uploaded" instead of errors.

**Q: What if it still fails?**
A: See full guide in `NETLIFY_ENV_VAR_CLEANUP.md` for deeper optimization.

## 🔗 Resources

- Full cleanup guide: `/docs/deployment/NETLIFY_ENV_VAR_CLEANUP.md`
- AWS Lambda limits: https://docs.aws.amazon.com/lambda/latest/dg/limits.html
- Netlify Functions: https://docs.netlify.com/functions/configure-and-deploy/
