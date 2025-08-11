# Debugging Documentation

This directory contains debugging guides and techniques for contributor.info development and production issues.

## Purpose

Debugging documentation helps developers:
- **Diagnose complex issues** - Step-by-step debugging procedures
- **Use debugging tools effectively** - Browser, database, and API debugging
- **Understand system behavior** - Internal process insights
- **Resolve production incidents** - Live system debugging techniques

## Documentation Index

### 🔧 System Integration Debugging
- **[GitHub Actions & Inngest Issues](./github-actions-inngest-issues.md)** - Debugging workflow and background job integration problems
- **[406 Error and Sync Issues](./406-error-and-sync-issues.md)** - Fixing Supabase 406 errors and repository sync problems
- **[Supabase .single() vs .maybeSingle()](./supabase-single-vs-maybeSingle.md)** - Common 406 error cause and how to properly use Supabase query methods

### 🧪 Test Debugging & Optimization
- **[Memory Leak Fix - LastUpdated Tests](./memory-leak-fix-last-updated-tests.md)** - Comprehensive guide to fixing memory leaks and CI hangs in React component tests

## Debugging Toolkit

### Browser Debugging Tools

#### React Developer Tools
```javascript
// Enable React debugging in console
window.React = React;
window.ReactDOM = ReactDOM;

// Component debugging
$r.props    // Current component props
$r.state    // Current component state
$r.context  // Component context
```

#### Network Debugging
```javascript
// Monitor API calls
localStorage.setItem('debug', 'contributor:*');

// Log all fetch requests
const originalFetch = window.fetch;
window.fetch = (...args) => {
  console.log('Fetch:', args);
  return originalFetch(...args);
};
```

#### Performance Debugging
```javascript
// Measure performance
performance.mark('start-operation');
// ... operation code ...
performance.mark('end-operation');
performance.measure('operation-time', 'start-operation', 'end-operation');
console.log(performance.getEntriesByType('measure'));
```

### Database Debugging

#### Supabase Query Debugging
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 0;

-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM contributors 
WHERE username = 'example';

-- Monitor active connections
SELECT * FROM pg_stat_activity 
WHERE state = 'active';
```

#### Real-time Subscription Debugging
```typescript
// Debug Supabase subscriptions
const subscription = supabase
  .channel('contributors')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'contributors' },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe((status, error) => {
    console.log('Subscription status:', status, error);
  });
```

### API Debugging

#### GitHub API Debugging
```bash
# Check rate limits
curl -H "Authorization: token $GITHUB_TOKEN" \
  -I https://api.github.com/rate_limit

# Debug webhook delivery
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/hooks/123/deliveries/456
```

#### GraphQL Query Debugging
```typescript
// Enable GraphQL debugging
const client = new ApolloClient({
  uri: 'https://api.github.com/graphql',
  headers: {
    Authorization: `Bearer ${token}`
  },
  defaultOptions: {
    query: { errorPolicy: 'all' }
  }
});

// Log all GraphQL operations
client.setLink(
  from([
    new ApolloLink((operation, forward) => {
      console.log('GraphQL Operation:', operation);
      return forward(operation);
    }),
    httpLink
  ])
);
```

## Common Debugging Scenarios

### Authentication Issues

#### Debugging OAuth Flow
```typescript
// Log OAuth state changes
const authStateLogger = {
  onSignIn: (user) => {
    console.log('User signed in:', user);
    console.log('JWT token:', user.access_token);
  },
  onSignOut: () => {
    console.log('User signed out');
  },
  onTokenRefresh: (token) => {
    console.log('Token refreshed:', token);
  }
};
```

#### Debugging RLS Policies
```sql
-- Test RLS policy as specific user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "user-id", "role": "authenticated"}';

-- Test query with RLS
SELECT * FROM contributors WHERE username = 'test';

-- Reset role
RESET ROLE;
```

### Data Synchronization Issues

#### Debugging GitHub Sync
```typescript
// Log sync operations
const syncLogger = {
  beforeSync: (repo) => {
    console.log(`Starting sync for ${repo.full_name}`);
    console.time(`sync-${repo.full_name}`);
  },
  afterSync: (repo, result) => {
    console.timeEnd(`sync-${repo.full_name}`);
    console.log(`Sync completed for ${repo.full_name}:`, result);
  },
  onError: (repo, error) => {
    console.error(`Sync failed for ${repo.full_name}:`, error);
  }
};
```

#### Debugging Queue Operations
```typescript
// Monitor queue status
const debugQueue = async () => {
  const stats = await supabase
    .from('sync_queue')
    .select('status, count(*)')
    .group('status');
    
  console.log('Queue statistics:', stats.data);
};

// Log job processing
const processJob = async (job) => {
  console.log('Processing job:', job.id, job.repository_name);
  console.time(`job-${job.id}`);
  
  try {
    const result = await executeJob(job);
    console.timeEnd(`job-${job.id}`);
    console.log('Job completed:', job.id, result);
  } catch (error) {
    console.timeEnd(`job-${job.id}`);
    console.error('Job failed:', job.id, error);
  }
};
```

### Performance Issues

#### Memory Leak Detection
```typescript
// Monitor component memory usage
const ComponentMemoryDebugger = (WrappedComponent) => {
  return class extends React.Component {
    componentDidMount() {
      console.log('Component mounted:', WrappedComponent.name);
      if (performance.memory) {
        console.log('Memory usage:', performance.memory);
      }
    }
    
    componentWillUnmount() {
      console.log('Component unmounting:', WrappedComponent.name);
      if (performance.memory) {
        console.log('Memory usage:', performance.memory);
      }
    }
    
    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
};
```

#### Bundle Size Analysis
```bash
# Analyze bundle composition
npm run build -- --analyze

# Check for duplicate dependencies
npx webpack-bundle-analyzer dist/static/js/*.js

# Measure runtime performance
npm run lighthouse
```

## Advanced Debugging Techniques

### Remote Debugging

#### Production Error Tracking
```typescript
// Enhanced error boundary with Sentry
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    Sentry.withScope((scope) => {
      scope.setTag('component', 'ErrorBoundary');
      scope.setContext('errorInfo', errorInfo);
      Sentry.captureException(error);
    });
  }
}
```

#### Live Production Debugging
```typescript
// Safe production debugging helpers
if (process.env.NODE_ENV === 'production') {
  window.debugUtils = {
    // Safe debug functions that don't expose sensitive data
    getPublicState: () => ({ 
      version: APP_VERSION,
      environment: 'production',
      timestamp: new Date().toISOString()
    }),
    testConnectivity: async () => {
      try {
        const response = await fetch('/api/health');
        return response.ok ? 'healthy' : 'unhealthy';
      } catch {
        return 'error';
      }
    }
  };
}
```

### Debugging Workflows

#### Systematic Issue Resolution
1. **Reproduce the issue** - Create minimal reproduction case
2. **Isolate the problem** - Identify the specific component/function
3. **Gather context** - Collect logs, network data, environment info
4. **Form hypothesis** - Based on available evidence
5. **Test hypothesis** - Make targeted changes
6. **Verify fix** - Ensure issue is resolved
7. **Document solution** - Update troubleshooting docs

#### Collaborative Debugging
```typescript
// Debug session sharing
const createDebugSession = (sessionId) => {
  const session = {
    id: sessionId,
    logs: [],
    state: {},
    timestamp: Date.now()
  };
  
  console.log = (...args) => {
    session.logs.push({ timestamp: Date.now(), args });
    originalConsoleLog(...args);
  };
  
  return session;
};
```

## Debugging Tools & Extensions

### Recommended Browser Extensions
- **React Developer Tools** - Component inspection
- **Redux DevTools** - State management debugging
- **Lighthouse** - Performance analysis
- **GraphQL Network Inspector** - GraphQL query debugging

### Command Line Tools
```bash
# Database debugging
supabase logs --type=database
supabase db inspect

# API debugging
curl -v -H "Authorization: Bearer $TOKEN" $API_ENDPOINT
httpie GET $API_ENDPOINT Authorization:"Bearer $TOKEN"

# Performance profiling
npm run build:profile
npm run analyze:bundle
```

### IDE Integration
```json
// VS Code debugging configuration
{
  "name": "Debug React App",
  "type": "chrome",
  "request": "launch",
  "url": "http://localhost:3000",
  "webRoot": "${workspaceFolder}/src",
  "sourceMaps": true,
  "trace": true
}
```

## Best Practices

### Debugging Mindset
- **Be systematic** - Follow logical debugging process
- **Document findings** - Keep track of what you've tried
- **Use version control** - Create debug branches for experimental fixes
- **Share knowledge** - Update docs with solutions

### Preventive Debugging
- **Comprehensive logging** - Log important operations and state changes
- **Error boundaries** - Catch and handle React component errors
- **Input validation** - Validate data at system boundaries
- **Health checks** - Regular system health monitoring

### Debugging Ethics
- **Respect privacy** - Never log sensitive user data
- **Secure debugging** - Remove debug code before production
- **Performance aware** - Don't leave expensive debug operations in production
- **Team coordination** - Communicate debugging efforts to avoid conflicts

## Related Documentation

- [Troubleshooting Guide](../troubleshooting/) - Issue resolution procedures
- [Postmortem Reports](../postmortem/) - Historical debugging insights
- [Monitoring Setup](../implementations/sentry-monitoring-setup.md) - Error tracking configuration

---

**Debugging Philosophy**: Every bug is a feature request from reality. Embrace debugging as an opportunity to understand your system better.