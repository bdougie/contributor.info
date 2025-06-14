# Development Environment Setup

This guide helps you set up a safe development environment for testing the Contributor.info database migration without affecting production data.

## Why Use a Development Environment?

- **Safety**: Test migrations without risking production data
- **Speed**: Faster iteration with local/development databases
- **Isolation**: Experiment with schema changes independently
- **Testing**: Validate your application changes with realistic data

## Setup Options

Choose the approach that best fits your workflow:

### Option 1: Local Supabase (Recommended for Development)

Run Supabase locally using Docker for the fastest development experience.

#### Prerequisites
- Docker Desktop installed and running
- Supabase CLI installed: `npm install -g supabase`

#### Setup Steps

1. **Initialize Local Supabase**
   ```bash
   cd /path/to/contributor.info
   
   # Initialize (if not already done)
   supabase init
   
   # Start local Supabase stack
   supabase start
   ```

2. **Apply Migration to Local Database**
   ```bash
   # Apply the migration
   supabase db push
   
   # Or manually apply
   supabase db reset
   ```

3. **Access Local Services**
   - **API URL**: `http://localhost:54321`
   - **Database URL**: `postgresql://postgres:postgres@localhost:54322/postgres`
   - **Studio**: `http://localhost:54323`
   - **Auth**: `http://localhost:54324`
   - **Storage**: `http://localhost:54325`
   - **Edge Functions**: `http://localhost:54326`

4. **Update Environment Variables**
   ```env
   # .env.local for development
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=your_local_anon_key
   VITE_GITHUB_TOKEN=your_github_token
   ```

5. **Seed Development Data**
   ```bash
   # Run the seed script
   supabase db seed seed.sql
   ```

### Option 2: Supabase Development Project

Create a separate Supabase project specifically for development.

#### Setup Steps

1. **Create New Supabase Project**
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Name it `contributor-info-dev`
   - Choose a different region if desired

2. **Link to Development Project**
   ```bash
   # Link to your dev project
   supabase link --project-ref YOUR_DEV_PROJECT_REF
   
   # Apply migration
   supabase db push
   ```

3. **Update Environment Variables**
   ```env
   # .env.development
   VITE_SUPABASE_URL=https://your-dev-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_dev_anon_key
   VITE_GITHUB_TOKEN=your_github_token
   ```

### Option 3: Database Branching (Pro/Enterprise)

If you have Supabase Pro or Enterprise, use database branching.

#### Setup Steps

1. **Create Development Branch**
   ```bash
   # Create a branch from production
   supabase branches create dev-migration-test
   
   # Switch to the branch
   supabase branches checkout dev-migration-test
   
   # Apply migration
   supabase db push
   ```

2. **Test and Validate**
   ```bash
   # Run your tests
   npm test
   
   # When satisfied, merge back
   supabase branches merge dev-migration-test
   ```

## Development Workflow

### 1. Schema Development Cycle

```bash
# 1. Start with clean local environment
supabase db reset

# 2. Apply your migration
supabase db push

# 3. Test with your application
npm run dev

# 4. Make schema adjustments if needed
# Edit migration file and repeat steps 1-3

# 5. When satisfied, deploy to staging/production
```

### 2. Seed Development Data

Create realistic test data for development:

```sql
-- File: supabase/seed.sql
-- Insert test repositories
INSERT INTO repositories (github_id, full_name, owner, name, description, language, stargazers_count)
VALUES 
  (1, 'test/repo1', 'test', 'repo1', 'Test repository 1', 'TypeScript', 100),
  (2, 'test/repo2', 'test', 'repo2', 'Test repository 2', 'Python', 250);

-- Insert test contributors  
INSERT INTO contributors (github_id, username, display_name, avatar_url)
VALUES 
  (1, 'testuser1', 'Test User 1', 'https://example.com/avatar1.png'),
  (2, 'testuser2', 'Test User 2', 'https://example.com/avatar2.png');

-- Insert test pull requests
INSERT INTO pull_requests (github_id, number, title, state, repository_id, author_id, created_at, additions, deletions)
VALUES 
  (1, 1, 'Test PR 1', 'closed', 
   (SELECT id FROM repositories WHERE full_name = 'test/repo1'),
   (SELECT id FROM contributors WHERE username = 'testuser1'),
   NOW() - INTERVAL '7 days', 100, 50),
  (2, 2, 'Test PR 2', 'open',
   (SELECT id FROM repositories WHERE full_name = 'test/repo2'), 
   (SELECT id FROM contributors WHERE username = 'testuser2'),
   NOW() - INTERVAL '3 days', 200, 25);
```

### 3. Testing Strategy

```bash
# Run application tests
npm test

# Test specific database queries
supabase db test

# Performance testing
supabase db test --performance

# Check migration rollback
supabase migration down
supabase migration up
```

## Environment Variables Management

Create separate environment files for different stages:

```bash
# .env.local (local development)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local_anon_key

# .env.development (dev project)  
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev_anon_key

# .env.staging (staging project)
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging_anon_key

# .env.production (production project)
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod_anon_key
```

## Useful Development Commands

```bash
# Database Management
supabase db start           # Start local database
supabase db stop            # Stop local database  
supabase db reset           # Reset local database
supabase db seed seed.sql   # Load seed data
supabase db dump            # Export database
supabase db push            # Apply migrations

# Migration Management
supabase migration list     # List all migrations
supabase migration new name # Create new migration
supabase migration up       # Apply pending migrations
supabase migration down     # Rollback last migration

# Project Management  
supabase projects list      # List all projects
supabase link              # Link to project
supabase status            # Check local status

# Function Management
supabase functions new name # Create new function
supabase functions deploy  # Deploy all functions
supabase functions logs    # View function logs
```

## Debugging Common Issues

### 1. Migration Fails

```bash
# Check migration syntax
supabase db lint

# View detailed error logs
supabase logs db

# Reset and try again
supabase db reset
```

### 2. Connection Issues

```bash
# Check if services are running
supabase status

# Restart local stack
supabase stop
supabase start
```

### 3. Environment Variables Not Loading

```bash
# Check current environment
echo $VITE_SUPABASE_URL

# Load specific env file
source .env.local
npm run dev
```

### 4. Seed Data Issues

```bash
# Check if tables exist
supabase db exec "\\dt"

# View table contents
supabase db exec "SELECT COUNT(*) FROM contributors;"

# Clear and reload seed data
supabase db reset
supabase db seed seed.sql
```

## Best Practices

### 1. Keep Environments Synchronized

- Use same migration files across all environments
- Version your seed data scripts
- Document environment-specific configurations

### 2. Data Management

- Use realistic but minimal test data
- Create different data sets for different test scenarios
- Don't commit sensitive data to version control

### 3. Testing

- Test migrations on development environment first
- Validate both forward and backward migration paths
- Test with different data volumes

### 4. Cleanup

```bash
# Clean up local environment when done
supabase stop
docker system prune -f

# Clean up development branches
supabase branches delete old-branch-name
```

## Production Deployment Checklist

Before applying the migration to production:

- [ ] Successfully tested on local environment
- [ ] Validated on development/staging environment
- [ ] Confirmed migration rollback works
- [ ] Backed up production database
- [ ] Planned maintenance window
- [ ] Team notified of deployment
- [ ] Monitoring and alerting ready

## Next Steps

1. **Choose your development approach** (local, dev project, or branching)
2. **Set up the environment** following the steps above
3. **Apply the migration** to your development environment
4. **Test thoroughly** with your application
5. **Configure RLS policies** (see RLS_POLICIES.md)
6. **Deploy to production** when confident

This development setup ensures you can safely test and iterate on your database changes without any risk to production data.