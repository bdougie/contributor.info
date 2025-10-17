# Setup Documentation

This directory contains comprehensive setup guides for contributor.info development, deployment, and architecture configuration.

## Purpose

Setup documentation helps developers:
- **Get started quickly** - Step-by-step environment setup
- **Understand architecture** - System design and component relationships
- **Configure integrations** - Third-party services and APIs
- **Deploy successfully** - Production deployment procedures

## Documentation Index

### 🏗️ Architecture & System Design
- **[Architecture Overview (2025-06-26)](./ARCHITECTURE_2025-06-26.md)** - Complete system architecture documentation
- **[Phase 1 Setup Guide](./phase1-setup.md)** - GitHub Events Classification Foundation setup

### 🤖 AI & LLM Integration
- **[LLM Integration Guide](./llm-integration.md)** - Language model integration setup
- **[LLM Quick Start](./llm-quick-start.md)** - Fast setup for AI features
- **[Maintainer Evaluations Dev Guide](./maintainer-evals-dev-guide.md)** - AI-powered contributor evaluations

## Quick Start Guide

### 1. Prerequisites
Before setting up contributor.info, ensure you have:

```bash
# Required tools
- Node.js 18+ 
- npm or yarn
- Git
- Supabase CLI

# Required accounts  
- GitHub account with Personal Access Token
- Supabase account and project
- (Optional) OpenAI API key for AI features
```

### 2. Environment Setup

```bash
# Clone the repository
git clone https://github.com/bdougie/contributor.info.git
cd contributor.info

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 3. Configure Environment Variables

```bash
# Public (browser-safe with VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GITHUB_TOKEN=your-readonly-token

# Private (server-only, no VITE_ prefix)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

### 4. Database Setup

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

### 5. Start Development

```bash
# Start the development server
npm run dev

# Open browser to http://localhost:5173
```

## Architecture Overview

### Core Components

```
contributor.info/
├── Frontend (React + TypeScript)
│   ├── Vite build system
│   ├── Tailwind CSS styling
│   └── Progressive enhancement
├── Backend Services
│   ├── Supabase (PostgreSQL database)
│   ├── Netlify (Static hosting & functions)
│   └── Fly.io Services
│       ├── GitHub Webhooks (webhooks-server/)
│       └── Social Cards (fly-social-cards/)
├── Data Pipeline
│   ├── GitHub API integration
│   ├── Smart data fetching
│   └── Background processing
└── AI Features
    ├── LLM integration
    ├── Contributor analysis
    └── Automated insights
```

### Infrastructure Services

| Service | Platform | Purpose | Status |
|---------|----------|---------|--------|
| Main App | Netlify | Static hosting, serverless functions | ✅ Active |
| Database | Supabase | PostgreSQL, real-time, auth | ✅ Active |
| GitHub Webhooks | Fly.io | Webhook processing | ✅ Active |
| Social Cards | Fly.io | Dynamic OG image generation | ✅ Active |
| Background Jobs | Inngest | Async processing | ✅ Active |

### Data Flow

1. **GitHub API** → Raw contributor data
2. **Smart Fetching** → Optimized data collection
3. **Supabase Database** → Structured storage
4. **React Frontend** → User interface
5. **AI Processing** → Enhanced insights

## Development Phases

### Phase 1: Foundation Setup
- ✅ Database schema and migrations
- ✅ GitHub API integration
- ✅ Basic data fetching
- ✅ Core UI components

### Phase 2: Smart Data Fetching
- ✅ Repository size classification
- ✅ Intelligent fetch strategies  
- ✅ Queue management system
- ✅ Performance monitoring

### Phase 3: AI Integration
- ✅ LLM model integration
- ✅ Contributor analysis
- ✅ Automated insights
- ✅ Maintainer evaluations

### Phase 4: Production Optimization
- ✅ Performance tuning
- ✅ Monitoring and alerting
- ✅ Security hardening
- ✅ Deployment automation

## Configuration Guidelines

### Development Environment
- Use local Supabase for development when possible
- Mock external APIs in tests
- Enable hot reloading for rapid iteration
- Use TypeScript strict mode

### Production Environment
- Enable all security headers
- Configure rate limiting
- Set up monitoring and alerting
- Use environment-specific configurations

### Testing Environment
- Separate test database
- Mock all external services
- Automated test data generation
- Parallel test execution

## Common Setup Issues

### Database Connection Problems
```bash
# Check Supabase connection
supabase db ping

# Verify environment variables
echo $VITE_SUPABASE_URL
```

### Authentication Issues
```bash
# Test GitHub token
curl -H "Authorization: token $VITE_GITHUB_TOKEN" \
  https://api.github.com/user
```

### Build Problems
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run typecheck
```

### Performance Issues
```bash
# Profile build performance
npm run build -- --profile

# Analyze bundle size
npm run analyze
```

## Integration Checklists

### ✅ GitHub Integration
- [ ] Personal Access Token configured
- [ ] Webhook endpoints set up
- [ ] Rate limiting configured
- [ ] Error handling implemented

### ✅ Supabase Integration  
- [ ] Database migrations applied
- [ ] RLS policies configured
- [ ] Edge functions deployed
- [ ] Real-time subscriptions working

### ✅ AI Features Integration
- [ ] OpenAI API key configured
- [ ] Model endpoints accessible
- [ ] Token usage monitoring
- [ ] Fallback mechanisms in place

## Deployment

### Development Deployment
```bash
# Build for development
npm run build:dev

# Deploy to staging
npm run deploy:staging
```

### Production Deployment
```bash
# Run full build and tests
npm run build
npm test

# Deploy to production
npm run deploy:production
```

## Monitoring & Maintenance

### Health Checks
- Database connectivity
- GitHub API rate limits
- Application performance metrics
- Error rates and patterns

### Regular Maintenance
- Dependency updates
- Security patches
- Database optimization
- Performance monitoring

## Support & Resources

### Internal Documentation
- [Data Fetching Guide](../data-fetching/) - Smart data collection system
- [Security Documentation](../security/) - Security best practices
- [Troubleshooting Guide](../troubleshooting/) - Common issue resolution

### External Resources
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Need help?** Check the troubleshooting guide or create an issue in the repository.