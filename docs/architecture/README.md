# System Architecture Documentation

This folder contains architectural documentation for the contributor.info application, including design decisions, patterns, and system components.

## Contents

### API Resilience

- **[github-api-exponential-backoff.md](./github-api-exponential-backoff.md)** - Comprehensive exponential backoff service for GitHub API calls with jitter implementation and rate limit handling
- **[retry-logic-and-resilience.md](./retry-logic-and-resilience.md)** - General retry logic and resilience patterns

### State Management

- **[state-machine-patterns.md](./state-machine-patterns.md)** - State machine patterns for complex workflows

### Background Processing

- **[inngest-functions.md](./inngest-functions.md)** - Inngest background job functions architecture

### Validation

- **[schema-validation-architecture.md](./schema-validation-architecture.md)** - Runtime validation using Zod schemas

### Utilities

- **[utility-functions-reference.md](./utility-functions-reference.md)** - Common utility functions and helpers

## Purpose

This directory documents:
- Architectural decisions and rationale
- System design patterns
- Component interactions
- Data flow diagrams
- Service boundaries
- Scalability considerations

## Architecture Overview

### Frontend Architecture
- React + TypeScript
- TanStack Query for data fetching
- TanStack Table for data grids
- Tailwind CSS for styling
- Service Workers for offline support

### Backend Architecture
- Supabase PostgreSQL database
- Supabase Edge Functions (Deno)
- Netlify Functions for API endpoints
- Inngest for background jobs
- GitHub API integration

### Data Flow
```
GitHub API → Inngest Jobs → Supabase Database → React Components
```

## Key Architectural Patterns

### Exponential Backoff
Resilient API calls with automatic retry:
- Configurable retry parameters
- Rate limit header parsing
- Jitter to prevent thundering herd
- Smart retry decision logic

### Database-First Loading
Prioritize cached data for instant UX:
- Query database first
- Fall back to API if needed
- Background refresh
- Automatic cache invalidation

### Progressive Enhancement
Core functionality works immediately:
- Cached data loads instantly
- Enhanced features load in background
- Graceful degradation
- No blocking operations

### Optimistic Updates
Instant UI feedback:
- Update UI immediately
- Perform async operations
- Rollback on errors
- Maintain consistency

## Service Boundaries

### Frontend Services
- Data fetching hooks
- State management
- UI components
- Service Worker

### Backend Services
- Edge Functions (Supabase)
- Netlify Functions
- Background jobs (Inngest)
- Database functions (PostgreSQL)

### External Services
- GitHub API
- OpenAI API
- PostHog analytics
- Resend email

## Scalability Considerations

### Database
- Table partitioning by date
- Optimized indexes
- RLS policies
- Connection pooling

### API Calls
- Rate limiting
- Request queuing
- Exponential backoff
- Token rotation

### Background Jobs
- Job prioritization
- Retry strategies
- Idempotency
- Error handling

## Performance Optimizations

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Service Worker caching

### Backend
- Database query optimization
- Batch operations
- Edge function warming
- CDN caching

## Security Architecture

### Authentication
- OAuth with GitHub
- Supabase Auth
- JWT tokens
- Service role keys

### Authorization
- Row Level Security (RLS)
- Policy-based access control
- Workspace permissions
- API key management

### Data Protection
- Environment variable encryption
- Secret management
- HTTPS everywhere
- Content Security Policy

## Related Documentation

- [Infrastructure](../infrastructure/) - Infrastructure setup
- [Database](../database/) - Database schema and queries
- [API](../api/) - API documentation
- [Integrations](../integrations/) - Third-party integrations
