# Supabase Setup for Contributor.info

This directory contains the Supabase configuration, migrations, and functions for the Contributor.info project.

## Project Structure

```
supabase/
├── README.md                    # This file
├── functions/                   # Edge Functions
│   ├── _shared/
│   │   └── cors.ts             # CORS helper
│   └── insights/
│       └── index.ts            # Insights API function
├── migrations/                  # Database migrations
│   └── 20240614000000_initial_contributor_schema.sql
└── seed.sql                     # Sample data (optional)
```

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install globally
   ```bash
   npm install -g supabase
   ```
3. **Node.js**: Version 18+ required
4. **GitHub Personal Access Token**: For API access

## Quick Start

### 1. Initial Setup

```bash
# Login to Supabase CLI
supabase login

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the database migration
supabase db push
```

### 2. Environment Variables

Create/update your `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GITHUB_TOKEN=your-github-token
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy insights
```

## Database Schema Overview

The migration creates a comprehensive database schema for storing GitHub contributor data:

### Core Tables

- **`contributors`** - GitHub user profiles and metadata
- **`repositories`** - Tracked GitHub repositories
- **`pull_requests`** - PR data with code changes and state
- **`reviews`** - PR review data with approval status
- **`comments`** - PR and issue comments
- **`organizations`** - GitHub organization information

### Analytics Tables

- **`monthly_rankings`** - Pre-calculated contributor leaderboards
- **`daily_activity_snapshots`** - Daily activity for trend analysis
- **`sync_logs`** - Track API synchronization operations

### Views & Functions

- **`contributor_stats`** - Real-time contributor statistics
- **`repository_stats`** - Repository contribution metrics
- **`recent_activity`** - Recent contributor activity (30 days)
- **`calculate_weighted_score()`** - Contributor ranking algorithm

## Migration Details

### File: `migrations/20240614000000_initial_contributor_schema.sql`

This migration includes:
- ✅ **Tables**: 11 core tables with proper relationships
- ✅ **Indexes**: Optimized for common query patterns
- ✅ **Views**: Pre-built queries for statistics
- ✅ **Functions**: Scoring and ranking algorithms
- ✅ **Triggers**: Automatic timestamp updates
- ✅ **Sample Data**: Test data for development

### Key Features

1. **Comprehensive Indexing**: Fast queries on usernames, repositories, dates
2. **Foreign Key Constraints**: Data integrity and referential consistency
3. **Weighted Scoring**: Algorithm for contributor rankings
4. **Flexible Time Ranges**: Support for various time-based queries
5. **Bot Detection**: Separate tracking for bot vs. human contributors

## Running the Migration

### Option 1: Supabase CLI (Recommended)

```bash
# Apply migration to your linked project
supabase db push

# Or reset and apply all migrations
supabase db reset
```

### Option 2: Direct SQL Execution

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the migration file contents
4. Execute the SQL

### Option 3: Using the MCP Server

Since you have the Supabase MCP server configured, you can also use it:

```bash
# List current migrations
supabase migrations list

# Apply specific migration
supabase migrations apply 20240614000000_initial_contributor_schema
```

## Post-Migration Setup

### 1. Row Level Security (RLS)

The migration doesn't include RLS policies by default. You'll need to configure them based on your security requirements:

```sql
-- Enable RLS on all tables
ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
-- ... (repeat for other tables)

-- Example: Allow public read access to contributors
CREATE POLICY "Public contributors are viewable by everyone" 
ON contributors FOR SELECT 
USING (TRUE);

-- Example: Only authenticated users can insert data
CREATE POLICY "Users can insert contributor data" 
ON contributors FOR INSERT 
TO authenticated 
WITH CHECK (TRUE);
```

### 2. Set Up Data Synchronization

Create a sync job to populate the database from GitHub API:

```typescript
// Example sync function
async function syncGitHubData() {
  const repos = ['owner/repo1', 'owner/repo2'];
  
  for (const repo of repos) {
    // Fetch and store repository data
    // Fetch and store contributor data
    // Fetch and store pull requests
  }
}
```

### 3. Configure GitHub API Access

Update your application to use the database instead of direct GitHub API calls:

```typescript
// Before: Direct GitHub API
const contributors = await fetchFromGitHub('/repos/owner/repo/contributors');

// After: Database query
const { data: contributors } = await supabase
  .from('contributor_stats')
  .select('*')
  .eq('repository_name', 'owner/repo');
```

## API Usage Examples

### Fetch Top Contributors

```sql
SELECT * FROM contributor_stats 
WHERE repositories_contributed > 0
ORDER BY total_pull_requests DESC 
LIMIT 10;
```

### Get Monthly Leaderboard

```sql
SELECT c.username, mr.weighted_score, mr.rank
FROM monthly_rankings mr
JOIN contributors c ON mr.contributor_id = c.id
WHERE mr.year = 2024 AND mr.month = 12
ORDER BY mr.rank ASC;
```

### Recent Activity Feed

```sql
SELECT * FROM recent_activity 
ORDER BY activity_date DESC 
LIMIT 50;
```

## Development Workflow

### 1. Local Development

```bash
# Start local Supabase
supabase start

# Your local URLs:
# API: http://localhost:54321
# Studio: http://localhost:54323
# Inbucket: http://localhost:54324
```

### 2. Making Schema Changes

```bash
# Create new migration
supabase migration new add_new_feature

# Edit migration file
# Apply changes
supabase db push
```

### 3. Testing

```bash
# Run tests against local database
npm test

# Seed with test data
supabase db seed
```

## Troubleshooting

### Common Issues

1. **Migration Fails**: Check for syntax errors in SQL
2. **Permission Denied**: Ensure RLS policies are correctly configured
3. **Slow Queries**: Verify indexes are created properly
4. **Data Sync Issues**: Check GitHub API rate limits

### Debug Commands

```bash
# Check migration status
supabase migration list

# View logs
supabase functions logs insights

# Check database connection
supabase db ping
```

## Performance Considerations

### Indexing Strategy

The migration includes indexes for:
- User lookups (username, github_id)
- Repository queries (owner, full_name)
- Time-based queries (created_at, updated_at)
- Relationship joins (foreign keys)

### Query Optimization

- Use the provided views for common queries
- Leverage the `calculate_weighted_score()` function
- Consider pagination for large result sets
- Use appropriate time ranges to limit data

### Monitoring

Monitor these metrics:
- Query performance in Supabase Dashboard
- GitHub API rate limit usage
- Database storage usage
- Edge function invocations

## Security Best Practices

1. **RLS Policies**: Implement appropriate row-level security
2. **API Keys**: Store securely and rotate regularly  
3. **GitHub Tokens**: Use minimal required scopes
4. **Input Validation**: Validate all data before insertion
5. **Audit Logs**: Track sensitive operations

## Next Steps

1. ✅ **Apply Migration**: Run the migration on your Supabase project
2. 📋 **Configure RLS**: Set up row-level security policies
3. 🔄 **Build Sync Jobs**: Create GitHub API synchronization
4. 🔗 **Update Frontend**: Modify app to use database queries
5. 🧪 **Test Thoroughly**: Validate all functionality works
6. 🚀 **Deploy**: Push changes to production

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Project Issues](https://github.com/your-org/contributor.info/issues)

---

**Note**: This setup provides a solid foundation for the Contributor.info project. Customize the RLS policies, sync jobs, and queries based on your specific requirements.