# Configuration Documentation

This directory contains configuration guides and specifications for contributor.info project settings.

## Purpose

Configuration documentation helps developers:
- **Understand project structure** - How configurations affect behavior
- **Customize deployments** - Environment-specific settings
- **Integrate new features** - Configuration requirements and options
- **Maintain consistency** - Standardized configuration patterns

## Documentation Index

### 📋 Project Configuration
- **[Contributor File Specification](./contributor-file.md)** - Configuration format for project contributor settings

## Configuration Overview

### Application Configuration

The project uses multiple configuration layers:

1. **Environment Variables** - Runtime configuration
2. **Config Files** - Build-time and development settings
3. **Database Configuration** - Schema and data structure
4. **API Configuration** - External service integration

### Key Configuration Files

```
contributor.info/
├── .env.local              # Environment variables
├── vite.config.ts          # Build configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Styling configuration
├── package.json            # Dependencies and scripts
└── supabase/
    ├── config.toml         # Supabase configuration
    └── migrations/         # Database schema
```

## Environment Configuration

### Development Environment
```bash
# Required for development
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GITHUB_TOKEN=your-development-token

# Optional for full functionality
OPENAI_API_KEY=your-openai-key
INNGEST_EVENT_KEY=your-inngest-key
```

### Production Environment
```bash
# All development variables plus:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret
SENTRY_DSN=your-sentry-dsn
```

### Testing Environment
```bash
# Test-specific overrides
VITE_SUPABASE_URL=http://localhost:54321
VITE_TEST_MODE=true
NODE_ENV=test
```

## Build Configuration

### Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
});
```

### TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Database Configuration

### Supabase Configuration (`supabase/config.toml`)
```toml
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
```

### Migration Configuration
- All migrations in `supabase/migrations/`
- Follow naming convention: `YYYYMMDD_description.sql`
- Include rollback procedures where applicable
- Test on development before production

## API Configuration

### GitHub API Integration
```typescript
// GitHub API client configuration
const github = new Octokit({
  auth: process.env.VITE_GITHUB_TOKEN,
  userAgent: 'contributor.info/1.0.0',
  timeZone: 'UTC',
  request: {
    retries: 3,
    retryAfter: 60,
    timeout: 10000
  }
});
```

### Supabase Client Configuration
```typescript
// Supabase client setup
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);
```

## Feature Configuration

### AI/LLM Configuration
```typescript
// OpenAI client configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
  maxRetries: 3,
  timeout: 30000
});
```

### Monitoring Configuration
```typescript
// Sentry configuration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1
});
```

## Configuration Best Practices

### Security
- ✅ Never commit secrets to version control
- ✅ Use environment variables for sensitive data
- ✅ Implement proper secret rotation
- ✅ Validate configuration at startup

### Performance
- ✅ Optimize bundle splitting in build config
- ✅ Configure appropriate cache headers
- ✅ Set reasonable timeout values
- ✅ Implement connection pooling

### Maintainability
- ✅ Document all configuration options
- ✅ Use TypeScript for configuration files
- ✅ Implement configuration validation
- ✅ Version configuration changes

### Development Experience
- ✅ Provide sensible defaults
- ✅ Include development-specific overrides
- ✅ Enable hot reloading and fast refresh
- ✅ Configure IDE integration

## Configuration Validation

### Environment Variable Validation
```typescript
// Validate required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_GITHUB_TOKEN'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

### Configuration Schema
```typescript
// Configuration schema validation
import { z } from 'zod';

const configSchema = z.object({
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1)
  }),
  github: z.object({
    token: z.string().min(1),
    webhookSecret: z.string().optional()
  }),
  features: z.object({
    aiEnabled: z.boolean().default(false),
    realtimeEnabled: z.boolean().default(true)
  })
});
```

## Troubleshooting Configuration Issues

### Common Problems
1. **Missing environment variables** - Check `.env.local` file
2. **Invalid URLs** - Verify Supabase project URL format
3. **Permission errors** - Check API token scopes
4. **Build failures** - Validate TypeScript configuration

### Debug Commands
```bash
# Check environment variables
printenv | grep VITE_

# Validate configuration
npm run config:validate

# Test API connections
npm run test:connections
```

## Related Documentation

- [Setup Guide](../setup/) - Initial project configuration
- [Security Documentation](../security/) - Security configuration best practices
- [Troubleshooting Guide](../troubleshooting/) - Configuration issue resolution

---

**Configuration Principle**: Make the right thing easy and the wrong thing hard through thoughtful defaults and validation.