# Contributing to Contributor.info

Thank you for your interest in contributing to Contributor.info! This guide will help you get started with development, testing, and submitting contributions.

_If you would like to work an issue, please read the [TRIAGE.md](/TRIAGE.md)_

## 🚀 Quick Start

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/contributor.info.git
   cd contributor.info
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your development environment**
   ```bash
   # Copy the environment template
   cp .env.example .env.local
   
   # Choose your development approach:
   # Option A: Local Supabase (recommended for contributors)
   npm run env:local
   npm run supabase:start
   
   # Option B: Production database (maintainers only)
   npm run env:production
   # Add your production credentials to .env.local
   ```

4. **Start developing**
   ```bash
   npm run dev
   ```

## 📋 Prerequisites

- **Node.js** (v20 or later)
- **npm** (v10 or later)
- **Docker Desktop** (for local Supabase development)
- **GitHub account** with Personal Access Token
- **Git** configured with your GitHub credentials

## 🗄️ Database Setup

Contributor.info uses Supabase for its database and authentication. We support flexible development environments:

### Option 1: Local Supabase (Recommended for Contributors)

The safest and most isolated development experience:

```bash
# Switch to local environment
npm run env:local

# Start local Supabase (requires Docker)
npm run supabase:start

# Check status
npm run supabase:status

# Access Supabase Studio at http://localhost:54323
```

### Option 2: Production Database (Maintainers Only)

For debugging production issues or testing with real data:

```bash
# Switch to production environment
npm run env:production

# Ensure you have production credentials in .env.local
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Environment Switching

Use our built-in environment switcher to toggle between local and production:

```bash
npm run env:local        # Switch to local Supabase
npm run env:production   # Switch to production (requires credentials)
```

The switcher automatically:
- Backs up your current `.env.local`
- Updates all necessary environment variables
- Validates credentials before switching
- Shows clear status and next steps

**📚 Detailed Setup Guides:**
- **[Local Development Guide](./docs/setup/LOCAL_DEVELOPMENT.md)** - Complete local environment setup
- **[Windows Setup Guide](./docs/setup/WINDOWS_SETUP.md)** - Windows-specific instructions (WSL2 and native)
- **[Migration Guide](./supabase/MIGRATION_GUIDE.md)** - Database migration instructions
- **[Supabase Documentation](./supabase/README.md)** - Comprehensive database documentation

### Database Schema

Our database includes:
- **Contributors** - GitHub user profiles and statistics
- **Repositories** - Tracked repository information
- **Pull Requests** - PR data with code changes
- **Reviews & Comments** - PR feedback and discussion
- **Monthly Rankings** - Contributor leaderboards
- **Analytics Tables** - Activity tracking and insights

## 🗃️ Database Migrations

### Writing New Migrations

When creating database schema changes, follow these guidelines to ensure migrations work in both production and local development environments:

1. **Use the Migration Template**
   ```bash
   # Copy the template for new migrations
   cp supabase/migrations/TEMPLATE.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_your_migration_name.sql
   ```

2. **Key Patterns for Local Compatibility**

   **Auth Dependencies** - Wrap auth-dependent code in conditional checks:
   ```sql
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
       -- Your auth-dependent code here
       CREATE POLICY "Users can view own data" ON your_table
         FOR SELECT
         USING (auth.uid() = user_id);
     END IF;
   END $$;
   ```

   **Role Creation** - Create roles if they don't exist:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
       CREATE ROLE service_role;
     END IF;
   END $$;
   ```

   **Extensions** - Make extensions optional:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   
   -- For extensions that might not be available locally (like pg_cron)
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
       CREATE EXTENSION IF NOT EXISTS pg_cron;
     ELSE
       RAISE NOTICE 'pg_cron not available - skipping';
     END IF;
   END $$;
   ```

   **Idempotent Operations** - Always use IF EXISTS/IF NOT EXISTS:
   ```sql
   CREATE TABLE IF NOT EXISTS your_table (...);
   CREATE INDEX IF NOT EXISTS idx_your_index ON your_table(column);
   DROP TRIGGER IF EXISTS your_trigger ON your_table;
   ```

3. **Validate Your Migration**
   ```bash
   # Check for environment-specific dependencies
   node scripts/migrations/analyze-migrations.js
   
   # Validate migrations for local compatibility
   node scripts/migrations/validate-migrations.js
   
   # Generate local-safe versions
   node scripts/migrations/generate-local-safe.js
   ```

4. **Test Locally**
   ```bash
   # Reset local database with new migration
   npm run supabase:reset
   
   # Or apply just your migration
   npx supabase db push
   ```

### Migration CI/CD Pipeline

All migrations are automatically validated when you create a PR:

1. **Validation Workflow** - Checks for environment-specific dependencies
2. **Local-Safe Generation** - Creates compatible versions for local development
3. **Test on Fresh Database** - Ensures migrations run cleanly
4. **Auto-Sync** - When merged, local-safe versions are automatically generated

### Migration Organization

Migrations are organized into categories:
- **Core Schema** - Tables, indexes, functions
- **Auth & RLS** - Authentication and security policies
- **Extensions** - PostgreSQL extensions and features
- **Seed Data** - Initial data and configurations

### Troubleshooting Migration Issues

| Issue | Solution |
|-------|----------|
| "auth schema not found" | Migration uses auth functions - wrap in conditional checks |
| "role does not exist" | Create roles conditionally before granting permissions |
| "extension not available" | Use IF NOT EXISTS and handle pg_cron specially |
| "multiple migration matches" | Migrations aren't idempotent - add IF EXISTS checks |

For detailed documentation, see:
- [Migration Template](./supabase/migrations/TEMPLATE.sql) - Complete examples
- [Database Migrations Guide](./docs/setup/DATABASE_MIGRATIONS.md) - Full documentation
- [Migration Scripts](./scripts/migrations/) - Analysis and fix tools

## 🔧 Environment Variables

The `.env.example` file includes all necessary variables with clear sections:

```env
# Environment indicator (set by env switcher)
VITE_ENV=local

# For LOCAL development (auto-configured by npm run env:local)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Local development key

# For PRODUCTION (preserve your existing values)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-production-key

# GitHub API (required for both environments)
VITE_GITHUB_TOKEN=ghp_your_github_personal_access_token

# Optional services
# VITE_OPENAI_API_KEY=your_openai_api_key
```

### Getting Your GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with these scopes:
   - `public_repo` - Access public repositories
   - `read:org` - Read organization data
   - `read:user` - Read user profile data

## 🏗️ Development Workflow

### 1. Project Structure

```
contributor.info/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── auth-button.tsx # Authentication components
│   │   ├── contributor-*   # Contributor-related components
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── use-github-*.ts # GitHub API hooks
│   │   ├── use-contributor-*.ts # Contributor data hooks
│   │   └── ...
│   ├── lib/                # Utilities and API clients
│   │   ├── github.ts       # GitHub API integration
│   │   ├── supabase.ts     # Supabase client
│   │   ├── types.ts        # TypeScript definitions
│   │   └── utils.ts        # Helper functions
│   └── App.tsx             # Main application
├── supabase/               # Database configuration
│   ├── config.toml         # Local Supabase configuration
│   ├── migrations/         # Database migrations
│   ├── functions/          # Edge functions
│   └── seed.sql           # Test data
├── scripts/
│   └── setup/             # Setup utilities
│       └── switch-environment.js  # Environment switcher
├── docs/
│   └── setup/             # Setup documentation
│       ├── LOCAL_DEVELOPMENT.md   # Local dev guide
│       └── WINDOWS_SETUP.md       # Windows guide
└── tasks/                  # Project planning documents
```

### 2. Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Environment Management (NEW!)
npm run env:local        # Switch to local Supabase
npm run env:production   # Switch to production database

# Database Management (using npx, no global install needed)
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run supabase:reset   # Reset database with migrations
npm run supabase:status  # Check Supabase status
npm run supabase:migrate # Apply migrations

# Code Quality
npm run lint                 # Run ESLint
npm run typecheck:functions  # TypeScript check for functions
npm test                     # Run tests
npm run test:watch           # Run tests in watch mode
npm run test:ui              # Run tests with UI
```

### 3. Platform-Specific Notes

#### Windows Development
- **Recommended**: Use WSL2 for best compatibility
- **Alternative**: Native Windows with PowerShell also supported
- All npm scripts use `npx` to avoid global installation issues
- See [Windows Setup Guide](./docs/setup/WINDOWS_SETUP.md) for detailed instructions

#### macOS
- Docker Desktop or Colima both work well
- Apple Silicon (M1/M2/M3) fully supported

#### Linux
- Native Docker installation recommended
- May need to add user to `docker` group for permissions

### 4. Code Style and Standards

- **TypeScript**: Strict mode enabled, use proper types
- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS with shadcn/ui components
- **Testing**: Vitest for unit tests, Testing Library for components
- **Linting**: ESLint with React and TypeScript rules

### 5. Component Guidelines

```typescript
// Use proper TypeScript interfaces
interface ContributorCardProps {
  contributor: ContributorStats;
  onSelect?: (contributor: ContributorStats) => void;
}

// Follow naming conventions
export function ContributorCard({ contributor, onSelect }: ContributorCardProps) {
  // Component logic
}

// Use custom hooks for data fetching
export function useContributorData(repoUrl: string) {
  // Hook implementation
}
```

## 🧪 Testing

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:ui          # Visual test runner
```

### Writing Tests

- **Unit tests**: For utilities and pure functions
- **Component tests**: For React components using Testing Library
- **Integration tests**: For complex workflows
- **Database tests**: For Supabase queries and functions

Example test:
```typescript
import { render, screen } from '@testing-library/react';
import { ContributorCard } from './contributor-card';

test('displays contributor information', () => {
  const contributor = {
    login: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
    pullRequests: 10,
    percentage: 25.5
  };

  render(<ContributorCard contributor={contributor} />);
  
  expect(screen.getByText('testuser')).toBeInTheDocument();
  expect(screen.getByText('10 PRs')).toBeInTheDocument();
});
```

## 📝 Submitting Changes

### 1. Before You Start

- Check existing [issues](https://github.com/bdougie/contributor.info/issues) and [discussions](https://github.com/bdougie/contributor.info/discussions)
- For large changes, create an issue to discuss the approach first
- Review our [Project Requirements Documents](./tasks/) for planned features

### 2. Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   # or for issues
   git checkout -b issue/123/description
   ```

2. **Make your changes**
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run build            # Ensure it builds
   npm test                 # Run tests
   npm run lint             # Check code style
   ```

4. **Test with local database**
   ```bash
   npm run supabase:reset   # Reset local database
   # Test your feature thoroughly
   ```

### 3. Commit Guidelines

Use conventional commits:
```bash
feat: add contributor search functionality
fix: resolve avatar loading issue
docs: update setup instructions
test: add contributor card tests
chore: update dependencies
```

### 4. Pull Request Process

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**
   - Use a descriptive title
   - Reference related issues with `Closes #123` or `Fixes #123`
   - Describe what you changed and why
   - Include screenshots for UI changes

3. **PR Template Checklist**
   - [ ] Tests pass locally
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated if needed
   - [ ] Database migrations tested (if applicable)

## 🐛 Reporting Issues

When reporting bugs, please include:

- **Description**: Clear description of the issue
- **Steps to reproduce**: Detailed steps to recreate the problem
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Browser, Node.js version, OS
- **Screenshots**: If applicable

Use our issue templates for:
- 🐛 Bug reports
- ✨ Feature requests
- 📚 Documentation improvements
- ❓ Questions and discussions

## 🔒 Security

For security vulnerabilities, please email security@contributor.info instead of creating a public issue.

## 🏗️ Architecture and Design Decisions

### State Management
- **Zustand** for global state (time ranges, filters)
- **React Context** for repository stats
- **Custom hooks** for data fetching and caching

### API Strategy
- **GitHub API** for real-time data
- **Supabase** for cached data and analytics
- **Edge Functions** for insights and AI features

### Performance
- **React.memo** for expensive components
- **Skeleton loaders** for better UX
- **Virtualization** for large contributor lists
- **Database indexes** for fast queries

### Development Flexibility
- **Environment Switcher** for easy local/production toggling
- **Cross-platform support** with npx-based scripts
- **No global dependencies** required for development

## 📚 Additional Resources

- **[Local Development Guide](./docs/setup/LOCAL_DEVELOPMENT.md)** - Complete local setup instructions
- **[Windows Setup Guide](./docs/setup/WINDOWS_SETUP.md)** - Windows-specific development guide
- **[Supabase Setup Guide](./supabase/DEV_SETUP.md)** - Database development environment
- **[Migration Documentation](./supabase/MIGRATION_GUIDE.md)** - Database schema changes
- **[API Documentation](./supabase/README.md)** - Database schema and API reference
- **[Security Policies](./supabase/RLS_POLICIES.md)** - Row Level Security configuration
- **[Project Planning](./tasks/)** - PRDs and task documentation

## 🤝 Community

- **Discussions**: Use GitHub Discussions for questions and ideas
- **Issues**: Report bugs and request features
- **Pull Requests**: Contribute code improvements
- **Discord**: Join our community chat (link in repo)

## 📄 License

By contributing to Contributor.info, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Happy contributing!** 🎉 

If you have questions, don't hesitate to ask in our [Discussions](https://github.com/bdougie/contributor.info/discussions) or create an [Issue](https://github.com/bdougie/contributor.info/issues).

Thank you for helping make Contributor.info better for everyone! 🚀
