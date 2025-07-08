# System Architecture - Contributor.info

**Date:** June 26, 2025  
**Version:** Current State  
**Status:** Living Document

## Overview

Contributor.info is a React + TypeScript application that visualizes GitHub contributors and their contributions, with real-time data synchronization and performance monitoring capabilities.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React)       │    │   (Supabase)    │    │   APIs          │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • UI Components │    │ • PostgreSQL    │    │ • GitHub API    │
│ • State Mgmt    │◄──►│ • Edge Functions│◄──►│ • Auth Services │
│ • Routing       │    │ • RLS Policies  │    │                 │
│ • Data Fetching │    │ • Real-time     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### Frontend Layer
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** React Query + Context API
- **Routing:** React Router
- **Testing:** Vitest + React Testing Library
- **Storybook:** Component development and documentation

### Backend Layer
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime
- **Edge Functions:** Supabase Functions (Deno)
- **Storage:** Supabase Storage (for assets)

### Data Layer
- **Primary Database:** 11 core tables + 3 views
- **GitHub Integration:** REST API + GraphQL
- **Caching Strategy:** Query-based caching with React Query
- **Sync Mechanism:** Incremental updates with conflict resolution

## Database Schema

### Core Tables (11)
1. **contributors** - GitHub user profiles and metadata
2. **repositories** - Tracked repository information
3. **pull_requests** - PR data and metrics
4. **reviews** - Code review data
5. **comments** - Issue and PR comments
6. **organizations** - GitHub organization data
7. **contributor_organizations** - Many-to-many relationship
8. **tracked_repositories** - Repository tracking configuration
9. **monthly_rankings** - Aggregated monthly contributor stats
10. **daily_activity_snapshots** - Daily activity summaries
11. **sync_logs** - Data synchronization audit trail

### Views (3)
- **contributor_stats** - Aggregated contributor metrics
- **repository_stats** - Repository activity summaries  
- **recent_activity** - Latest contributor activities

### Planned Performance Tables
- **slow_queries** - Query performance monitoring
- **query_performance_alerts** - Performance alerting system

## Security Architecture

### Row Level Security (RLS)
- **Public Read Access:** Anonymous users can browse data
- **Progressive Authentication:** Login required for advanced features
- **Data Isolation:** User-specific data protection
- **API Key Management:** Secure GitHub token handling

### Authentication Flow
```
User Request → Supabase Auth → RLS Check → Data Access
     ↓              ↓              ↓           ↓
Anonymous → Public Read → Basic Data → Limited Features
Authenticated → Full Access → All Data → Advanced Features
```

## Performance Monitoring

### Current Implementation
- **Frontend:** Performance dashboard component
- **Metrics Collection:** React Query performance tracking
- **Error Tracking:** Console logging and error boundaries

### Planned Enhancements (Issue #128)
- **Database Monitoring:** Connection pool and query performance
- **Health Checks:** System status endpoints
- **Alerting System:** Performance degradation notifications
- **Edge Functions:** `/health`, `/health-database`, `/health-github`

## Data Flow

### GitHub Sync Process
```
GitHub API → Data Validation → Conflict Resolution → Database Update → Real-time Broadcast
     ↓              ↓                   ↓                    ↓              ↓
Rate Limiting → Schema Mapping → Merge Strategy → Supabase → WebSocket Push
```

### User Experience Flow
```
Page Load → Initial Data Fetch → Real-time Updates → User Interactions
     ↓              ↓                    ↓                ↓
SSR/Cache → React Query → Supabase → State Updates
```

## Development Architecture

### Build Pipeline
```bash
npm run build  # Runs tests + typecheck + production build
```

### Testing Strategy
- **Unit Tests:** Vitest for utilities and hooks
- **Component Tests:** React Testing Library
- **Integration Tests:** Supabase mocked in test environment
- **E2E Tests:** Planned with Playwright

### Code Organization
```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── features/       # Feature-specific components
│   └── layout/         # Layout components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── pages/              # Route components
└── types/              # TypeScript definitions
```

## Deployment Architecture

### Environment Strategy
- **Development:** Local Supabase + Vite dev server
- **Staging:** Supabase hosted + Vercel preview
- **Production:** Supabase hosted + Vercel production

### Database Migrations
- **Schema Changes:** Supabase CLI migrations
- **Data Migrations:** Custom SQL scripts
- **Rollback Strategy:** Version-controlled migration files

## Technical Debt & Optimization Opportunities

### Known Issues
- **Unused Tables:** Audit required to identify empty/unused tables
- **Query Optimization:** Some queries may benefit from indexing
- **Bundle Size:** Potential for code splitting improvements

### Future Enhancements
- **Caching Layer:** Redis for frequently accessed data
- **Search Optimization:** Full-text search with PostgreSQL
- **Analytics:** User behavior tracking
- **Mobile Optimization:** Progressive Web App features

## Monitoring & Observability

### Current State
- **Error Tracking:** Console-based logging
- **Performance:** React Query DevTools
- **Database:** Supabase Dashboard metrics

### Planned Improvements
- **APM Integration:** Application Performance Monitoring
- **Custom Dashboards:** Business metrics visualization
- **Alerting System:** Proactive issue detection

---

**Maintainer:** @bdougie  
**Last Updated:** June 26, 2025  
**Next Review:** Quarterly (September 2025)