# Troubleshooting Documentation

This directory contains active troubleshooting guides for resolving common issues in contributor.info development and operations.

## Purpose

Troubleshooting documentation helps developers:
- **Resolve issues quickly** - Step-by-step problem resolution
- **Diagnose root causes** - Tools and techniques for debugging
- **Prevent recurring problems** - Understanding failure patterns
- **Share solutions** - Community knowledge base

## Documentation Index

### 🔧 Build & Deployment Issues
- **[GitHub Actions Errors](./github-actions-errors.md)** - Workflow failures and debugging

## Quick Troubleshooting Checklist

When encountering issues, work through this checklist:

### 1. Environment Check ✅
```bash
# Verify environment variables
echo $VITE_SUPABASE_URL
echo $VITE_GITHUB_TOKEN

# Check Node.js and npm versions
node --version  # Should be 18+
npm --version
```

### 2. Dependencies Check ✅
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Check for security vulnerabilities
npm audit
```

### 3. Database Connectivity ✅
```bash
# Test Supabase connection
supabase db ping

# Check migration status
supabase migration list
```

### 4. GitHub API Access ✅
```bash
# Test GitHub token
curl -H "Authorization: token $VITE_GITHUB_TOKEN" \
  https://api.github.com/user

# Check rate limits
curl -H "Authorization: token $VITE_GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

## Common Issue Categories

### 🔐 Authentication & Authorization

#### GitHub Authentication Issues
- **Symptoms**: "Bad credentials" or 401 errors
- **Causes**: Expired tokens, insufficient scopes, rate limiting
- **Solutions**: 
  - Regenerate GitHub Personal Access Token
  - Verify token scopes include required permissions
  - Check rate limit status

#### Supabase Authentication Issues
- **Symptoms**: "Invalid JWT" or connection errors
- **Causes**: Wrong project URL, expired keys, RLS policy conflicts
- **Solutions**:
  - Verify SUPABASE_URL and ANON_KEY match your project
  - Check RLS policies allow required operations
  - Test with service role key for admin operations

### 🗄️ Database Issues

#### Migration Failures
- **Symptoms**: "Migration failed" or schema errors
- **Causes**: Conflicting changes, permission issues, syntax errors
- **Solutions**:
  - Reset database: `supabase db reset`
  - Apply migrations manually via SQL Editor
  - Check migration file syntax

#### Query Performance Issues
- **Symptoms**: Slow loading, timeouts, high CPU usage
- **Causes**: Missing indexes, large datasets, inefficient queries
- **Solutions**:
  - Add appropriate database indexes
  - Implement pagination for large datasets
  - Optimize query patterns

### 🚀 Build & Deployment Issues

#### TypeScript Errors
- **Symptoms**: Build fails with type errors
- **Causes**: Missing types, outdated dependencies, configuration issues
- **Solutions**:
  - Update TypeScript and type definitions
  - Check tsconfig.json configuration
  - Fix type annotations in code

#### Build Performance Issues  
- **Symptoms**: Slow builds, memory errors during compilation
- **Causes**: Large bundle sizes, inefficient imports, memory leaks
- **Solutions**:
  - Analyze bundle with `npm run analyze`
  - Implement code splitting
  - Use dynamic imports for large dependencies

### 🔄 Data Synchronization Issues

#### GitHub API Rate Limiting
- **Symptoms**: "API rate limit exceeded" errors
- **Causes**: Too many requests, inefficient API usage
- **Solutions**:
  - Implement exponential backoff retry logic
  - Use GraphQL API for complex queries
  - Cache frequently accessed data

#### Data Consistency Issues
- **Symptoms**: Stale data, missing records, duplicate entries
- **Causes**: Race conditions, failed transactions, sync errors
- **Solutions**:
  - Implement proper transaction handling
  - Add data validation and conflict resolution
  - Use database constraints and triggers

### 🎨 Frontend Issues

#### Component Rendering Issues
- **Symptoms**: Blank pages, component errors, hydration mismatches
- **Causes**: State management issues, prop type mismatches, lifecycle problems
- **Solutions**:
  - Check React Developer Tools for component state
  - Verify prop types and data flow
  - Test component isolation in Storybook

#### Performance Issues
- **Symptoms**: Slow page loads, janky animations, high memory usage
- **Causes**: Large bundle sizes, inefficient re-renders, memory leaks
- **Solutions**:
  - Use React.memo for expensive components
  - Implement virtualization for large lists
  - Profile with React Developer Tools

## Debugging Tools & Techniques

### Browser Developer Tools
```javascript
// Enable React debugging
window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces.forEach(r => {
  r.profilerStore.isRecording = true;
});

// Debug API calls
localStorage.setItem('debug', 'contributor:*');
```

### Supabase Debugging
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM contributors 
WHERE username = 'example';

-- Monitor real-time subscriptions
SELECT * FROM pg_stat_activity 
WHERE application_name LIKE '%supabase%';
```

### GitHub API Debugging
```bash
# Debug webhook deliveries
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/hooks/123/deliveries

# Check API response headers
curl -I -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo
```

## Error Monitoring & Alerting

### Sentry Integration
- Real-time error tracking
- Performance monitoring
- Release tracking and deploy notifications
- User feedback collection

### Custom Monitoring
```typescript
// Log errors with context
console.error('GitHub sync failed', {
  repository: repo.full_name,
  error: error.message,
  timestamp: new Date().toISOString()
});
```

### Health Check Endpoints
```typescript
// API health check
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabaseConnection(),
    github: await checkGitHubAPI(),
    cache: await checkRedisConnection()
  };
  
  const healthy = Object.values(checks).every(check => check.status === 'ok');
  res.status(healthy ? 200 : 503).json(checks);
});
```

## Escalation Procedures

### Level 1: Self-Service
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Review recent postmortems for similar issues
4. Test in development environment

### Level 2: Team Support
1. Create detailed issue with reproduction steps
2. Include relevant logs and error messages
3. Tag appropriate team members
4. Schedule debugging session if needed

### Level 3: Incident Response
1. For production issues affecting users
2. Follow incident response procedures
3. Create postmortem after resolution
4. Update documentation with lessons learned

## Prevention Strategies

### Code Quality
- Comprehensive test coverage
- Static analysis and linting
- Regular dependency updates
- Security vulnerability scanning

### Monitoring & Observability
- Real-time error tracking
- Performance monitoring
- User experience monitoring
- Infrastructure health checks

### Documentation & Training
- Keep troubleshooting guides updated
- Share solutions in team channels
- Conduct post-incident reviews
- Regular team knowledge sharing

## Related Documentation

- [Postmortem Reports](../postmortem/) - Historical incident analysis
- [Security Guidelines](../security/) - Security-related troubleshooting
- [Setup Documentation](../setup/) - Environment configuration issues
- [Implementation Guides](../implementations/) - Feature-specific debugging

---

**Remember**: When troubleshooting, document your findings to help others facing similar issues. Every problem solved is a learning opportunity for the team.