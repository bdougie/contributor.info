---
globs: "**/*.{ts,tsx,js,jsx,env,yml,yaml,json}"
description: Never commit environment variables or secrets
---

# Environment Variables and Secrets Security

Never commit environment variables, API keys, or secrets to the repository. This is a critical security requirement.

## Rules

1. **Never hardcode secrets** - API keys, tokens, and passwords must never appear in code
2. **Use environment variables** - Access secrets through `process.env` or `import.meta.env`
3. **Check before committing** - Review all changes for accidental secret exposure
4. **Use proper patterns** - Follow the ESM/CommonJS compatible pattern for env vars

## TypeScript Environment Variables Pattern

Due to mixed module contexts (Netlify Functions use CommonJS, Vite uses ESM), use this fallback pattern:

✅ **Correct pattern for environment variables:**
```typescript
const VITE_GITHUB_TOKEN = import.meta.env?.VITE_GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
const VITE_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
```

## Examples of What NOT to Commit

❌ **Never commit these:**
```javascript
const API_KEY = "sk-1234567890abcdef";  // NEVER DO THIS
const supabaseKey = "eyJhbGciOiJIUzI1NiIs..."; // NEVER DO THIS
```

✅ **Always use environment variables:**
```javascript
const API_KEY = process.env.API_KEY;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
```

## Files to Check

- Never commit `.env` files (should be in .gitignore)
- Review changes to configuration files
- Check for secrets in comments or documentation
- Ensure example files use placeholders like `your-api-key`