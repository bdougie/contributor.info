# Seed Data Generation Guide

This guide covers how to populate your local development database with realistic seed data using the integrated Inngest background processing system.

## Overview

The seed data generation system fetches real data from popular GitHub repositories and processes it through Inngest, providing you with:
- **Real-world data patterns** for testing
- **Background processing** that doesn't block development
- **7-14 days of recent activity** for quick setup
- **Progressive data loading** as you work

## Quick Start

```bash
# 1. Set up your GitHub token (see below)
# 2. Start local Supabase
npm run supabase:start

# 3. Generate seed data
npm run db:seed

# 4. Start Inngest to process the data
npm run dev:inngest

# 5. Check progress
npm run seed:status

# 6. Start development
npm run dev
```

## Setting Up Your GitHub Token

### Step 1: Create a Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens/new
2. Give your token a descriptive name: `contributor-info-local-dev`
3. Set expiration (90 days recommended for development)
4. Select the following scopes:
   - ✅ `public_repo` - Access public repositories
   - ✅ `read:user` - Read user profile data

5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)

### Step 2: Add Token to Environment

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your token:
```bash
VITE_GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_TOKEN=ghp_your_actual_token_here
```

> **Security Note**: Never commit `.env.local` to version control!

## How Seed Data Generation Works

### 1. Repository Tracking
The script first tracks these example repositories in your database:
- **continuedev/continue** - AI code assistant
- **vitejs/vite** - Frontend build tool
- **facebook/react** - UI library
- **vercel/next.js** - React framework
- **supabase/supabase** - Backend platform

### 2. Job Queueing
For each repository, the system:
- Creates a progressive capture job in the database
- Queues it for Inngest processing
- Marks it with seed generation metadata

### 3. Background Processing
Inngest processes the jobs:
- Fetches pull requests from the last 14 days
- Captures contributor information
- Collects reviews and comments
- Updates the database progressively

### 4. Data Availability
Data becomes available as it's processed:
- The app shows data immediately as it arrives
- No need to wait for all processing to complete
- Background updates continue while you work

## Configuration Options

### Customize Timeframe
Edit `.env.local` to change the data collection period:
```bash
SEED_DATA_DAYS=7  # Collect last 7 days instead of 14
```

### Add Different Repositories
Modify the repository list in `.env.local`:
```bash
SEED_REPOSITORIES=owner1/repo1,owner2/repo2,owner3/repo3
```

## Monitoring Progress

### Check Job Status
```bash
npm run seed:status
```

This shows:
- Job queue status (pending, processing, completed)
- Data availability (repositories, PRs, contributors)
- Recommendations for next steps

### Inngest Dashboard
View detailed processing status:
1. Start Inngest: `npm run dev:inngest`
2. Open dashboard: http://localhost:8288
3. Monitor events and function runs

### Supabase Studio
View your data directly:
1. Open: http://localhost:54323
2. Navigate to Table Editor
3. Browse repositories, pull_requests, contributors

## Troubleshooting

### "Missing GitHub token" Error
**Solution**: Ensure `VITE_GITHUB_TOKEN` is set in `.env.local`

### "Rate limited" Message
**Solution**: The script automatically waits for rate limits to reset. This is normal.

### Jobs Stay "Pending"
**Solution**: Make sure Inngest is running:
```bash
npm run dev:inngest
```

### No Data Appearing
1. Check job status: `npm run seed:status`
2. Verify Inngest is processing: http://localhost:8288
3. Check Supabase logs: `npm run supabase:status`

### Windows-Specific Issues
- Use Git Bash or WSL2 for running scripts
- Ensure Docker Desktop is running for Supabase
- Check line endings are LF (not CRLF)

## Expected Data Structure

After successful seed generation, you'll have:

### Repositories (5)
- Basic metadata (stars, forks, language)
- Tracking status enabled
- Last update timestamps

### Pull Requests (~200-300)
- Various states (open, closed, merged)
- File change statistics
- Branch information
- Links to GitHub

### Contributors (~50-100)
- Profile information
- Avatar URLs
- Contribution statistics

### Reviews & Comments (Variable)
- PR review states
- Comment threads
- Reviewer information

## Performance Expectations

- **Initial setup**: 5-10 minutes
- **Data processing**: 15-30 minutes (runs in background)
- **Network usage**: ~50-100 MB
- **Database size**: ~10-20 MB

## Advanced Usage

### Manual Repository Addition
```javascript
// In browser console
const trigger = await import('./src/lib/progressive-capture/manual-trigger');
await trigger.ProgressiveCaptureTrigger.bootstrap();
```

### Force Data Refresh
```bash
# Clear existing data
psql -h localhost -p 54322 -U postgres -d postgres -c "TRUNCATE repositories CASCADE;"

# Re-run seed generation
npm run db:seed
```

### Custom Seed Data
Create `supabase/seed-custom.sql` for additional test data:
```sql
-- Custom test data
INSERT INTO repositories (github_id, full_name, owner, name) 
VALUES (999999, 'test/repo', 'test', 'repo');
```

## Integration with Development Workflow

### Recommended Development Flow
1. **Start services**: `npm run start` (includes Vite, Netlify, Inngest)
2. **Generate seed data**: `npm run db:seed` (first time only)
3. **Develop features**: Data loads progressively in background
4. **Test with real patterns**: Use seeded data for testing

### CI/CD Considerations
- Seed generation is for local development only
- Production uses real GitHub webhooks
- Test environments can use similar seed scripts

## Security Best Practices

1. **Token Management**
   - Use minimal scopes (public_repo, read:user)
   - Rotate tokens regularly
   - Never commit tokens to version control

2. **Data Privacy**
   - Seed data uses public repositories only
   - No private or sensitive information
   - Suitable for development and demos

3. **Rate Limiting**
   - Script respects GitHub rate limits
   - Automatic retry with backoff
   - ~5000 requests/hour with token

## Related Documentation

- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Database Migrations](./DATABASE_MIGRATIONS.md)
- [Progressive Capture System](../features/progressive-capture.md)
- [Inngest Integration](../features/inngest-integration.md)