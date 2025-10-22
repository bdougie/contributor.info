# Security Standards

## Environment Variables

- **NEVER commit environment variables** to version control
- Never write env variables inline into scripts
- Especially sensitive: SUPABASE tokens, keys, and URLs
- Use `.env` files that are gitignored
- Reference environment variables through proper configuration

## Logging Security

### ❌ Bad - Template Literal Injection
```typescript
console.log(`User: ${owner}`);  // Security vulnerability
```

### ✅ Good - Safe Logging
```typescript
console.log('%s', owner);  // Safe parameter substitution
```

## Review Checklist

- [ ] No environment variables committed
- [ ] No inline secrets in scripts
- [ ] Proper console.log formatting (no template literals with user data)
- [ ] Sensitive data properly redacted in logs
- [ ] API keys and tokens properly secured
