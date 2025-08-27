# Local Development Guide

This guide covers setting up and working with contributor.info locally, with support for both local Supabase and production database connections.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/bdougie/contributor.info.git
cd contributor.info

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local

# 4. Choose your database:
# Option A: Local Supabase (recommended for new contributors)
npm run env:local
npm run supabase:start

# Option B: Production Supabase (for maintainers)
npm run env:production
# Add your production keys to .env.local

# 5. Run migrations (local development)
bash supabase/migrations-local/setup-local.sh
# See docs/setup/DATABASE_MIGRATIONS.md for details

# 6. Generate seed data (optional but recommended)
npm run db:seed
# See docs/setup/SEED_DATA.md for details

# 7. Start development server (includes Inngest)
npm run start
# Or just the dev server:
npm run dev
```

## Environment Setup

### Flexible Environment Configuration

The project supports both local and production Supabase instances:

- **Local Development**: Uses Docker-based Supabase for isolated development
- **Production Access**: Direct connection to production Supabase (requires credentials)

### Environment Switcher

Use the built-in environment switcher to toggle between local and production:

```bash
# Switch to local Supabase
npm run env:local

# Switch to production Supabase (be careful!)
npm run env:production
```

The switcher will:
- Automatically backup your current `.env.local`
- Update all necessary environment variables
- Show you the current configuration
- Check Docker status for local development

### Manual Configuration

If you prefer manual setup, update these in `.env.local`:

```bash
# For Local Development
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ENV=local

# For Production
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_ENV=production
```

## Local Supabase Setup

### Prerequisites

- Docker Desktop installed and running
- Node.js 20+ and npm 10+

### Starting Local Supabase

```bash
# Start Supabase (includes database, auth, storage, etc.)
npm run supabase:start

# Check status
npm run supabase:status

# Access Supabase Studio (database GUI)
# Open: http://localhost:54323
```

### Seed Data Generation

The project includes an automated seed data generation system:

```bash
# Generate seed data from example repositories
npm run db:seed

# Check seed data status
npm run seed:status
```

This will:
- Track example repositories (continuedev/continue, vitejs/vite, etc.)
- Queue data capture jobs using Inngest
- Fetch 14 days of recent PR data
- Process data in the background while you work

See [SEED_DATA.md](./SEED_DATA.md) for complete documentation.

### Database Migrations

When working with local Supabase:

```bash
# IMPORTANT: Use local-safe migrations for local development
# Original migrations have auth/extension dependencies that fail locally

# Quick setup with local-safe migrations (recommended)
bash supabase/migrations-local/setup-local.sh

# Or manually apply consolidated migration
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations-local/000_consolidated_local_safe.sql

# Reset database (be careful - may fail with original migrations)
npm run supabase:reset

# Create a new migration (after making schema changes)
npx supabase migration new your_migration_name
```

**Note**: The original migrations contain environment-specific dependencies (auth, roles, extensions) that prevent them from running on fresh local Supabase. Use the local-safe versions in `supabase/migrations-local/` instead. See [Database Migrations Guide](./DATABASE_MIGRATIONS.md) for details.

### Seed Data

To populate your local database with test data:

```bash
# The seed file is automatically applied on reset
npm run supabase:reset

# Or manually apply seed data
npx supabase db seed
```

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server (port 5174)
npm start               # Start with Netlify Dev + Inngest
npm run build           # Production build
npm run preview         # Preview production build

# Database Management
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run supabase:reset   # Reset database with migrations
npm run supabase:status  # Check Supabase status

# Environment Management
npm run env:local        # Switch to local database
npm run env:production   # Switch to production database

# Testing
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:ui         # Vitest UI

# Code Quality
npm run lint                 # ESLint check
npm run typecheck:functions  # TypeScript check for functions
npm run build               # Full build (includes TypeScript check)
```

### Project Structure

```
contributor.info/
├── src/                    # Source code
│   ├── components/        # React components
│   ├── lib/              # Utilities and libraries
│   │   ├── supabase.ts   # Supabase client
│   │   └── github.ts     # GitHub API client
│   ├── pages/            # Page components
│   └── styles/           # Global styles
├── netlify/              # Netlify Functions
│   └── functions/        # Serverless functions
├── supabase/             # Supabase configuration
│   ├── config.toml       # Local config
│   ├── migrations/       # Database migrations
│   ├── functions/        # Edge Functions
│   └── seed.sql         # Seed data
├── scripts/              # Utility scripts
│   └── setup/           # Setup scripts
├── docs/                # Documentation
│   └── setup/          # Setup guides
└── tests/              # Test files
```

## Working with Different Environments

### Local Development (Default for Contributors)

Best for:
- New contributors
- Feature development
- Testing migrations
- Experimenting safely

```bash
npm run env:local
npm run supabase:start
npm run dev
```

Benefits:
- Complete isolation from production
- Fast iteration
- No risk to production data
- Full control over database state

### Production Database (Maintainers Only)

Best for:
- Debugging production issues
- Testing with real data
- Final validation before deployment

```bash
npm run env:production
# Ensure you have production credentials in .env.local
npm run dev
```

⚠️ **Warning**: Be extremely careful when connected to production:
- Read-only operations recommended
- Never run migrations without review
- Always test in local first
- Use feature branches

### Checking Current Environment

The app shows your current environment:
- Look for the environment badge in the footer
- Check browser console for: `Current environment: local/production`
- Run: `npm run supabase:status` to verify connection

## Platform-Specific Notes

### macOS
- Docker Desktop or Colima work well
- Use Homebrew for tool installation if preferred
- Apple Silicon (M1/M2) fully supported

### Windows
- See [Windows Setup Guide](./WINDOWS_SETUP.md) for detailed instructions
- WSL2 recommended for best experience
- Native Windows also supported with PowerShell

### Linux
- Native Docker installation recommended
- May need to run Docker commands with `sudo`
- Ensure your user is in the `docker` group

## Troubleshooting

### Docker Issues

```bash
# Check if Docker is running
docker ps

# If permission denied on Linux
sudo usermod -aG docker $USER
# Log out and back in

# Reset Docker state
docker system prune -a
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the ports
lsof -i :54321  # Supabase API
lsof -i :54322  # PostgreSQL
lsof -i :54323  # Supabase Studio

# Stop conflicting services
npm run supabase:stop
# Or kill the specific process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check Supabase status
npm run supabase:status

# Restart Supabase
npm run supabase:stop
npm run supabase:start

# Reset database if corrupted
npm run supabase:reset
```

### Environment Variable Issues

```bash
# Verify environment variables
cat .env.local | grep VITE_SUPABASE

# Switch environments to reset
npm run env:local  # or env:production

# Manually check/edit
nano .env.local
```

## Best Practices

1. **Always use feature branches**: Never commit directly to main
2. **Test locally first**: Use local Supabase before testing with production
3. **Keep Docker running**: Local development requires Docker
4. **Use environment switcher**: Avoid manual .env editing when possible
5. **Regular backups**: The switcher auto-backs up your .env.local
6. **Check migrations**: Review migration files before applying
7. **Seed data**: Use realistic test data in local development

## Advanced Configuration

### Custom Supabase Configuration

Edit `supabase/config.toml` to customize:
- API ports
- Auth settings
- Storage limits
- Email testing

### Running Multiple Projects

To avoid port conflicts with other Supabase projects:

1. Stop other projects: `supabase stop` in other directories
2. Or modify `supabase/config.toml` to use different ports
3. Update `.env.local` with new ports

### Using Supabase CLI Directly

While npm scripts are recommended, you can use the CLI directly:

```bash
# Install globally (optional)
npm install -g supabase

# Direct CLI commands
supabase start
supabase stop
supabase status
```

## Getting Help

- Check [GitHub Issues](https://github.com/bdougie/contributor.info/issues)
- Read [Supabase Docs](https://supabase.com/docs)
- Ask in project discussions
- Review [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines

## Next Steps

1. Set up your development environment
2. Run the test suite: `npm test`
3. Pick an issue to work on
4. Create a feature branch
5. Make your changes
6. Submit a pull request

Happy coding! 🚀