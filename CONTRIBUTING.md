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
   npm run db:setup  # Automated setup with consolidated migration
   
   # Option B: Production database (maintainers only)
   npm run env:production
   # Add your production credentials to .env.local
   ```

4. **Start developing**
   ```bash
   npm run dev
   ```

## 📋 Prerequisites

- **Node.js** v20 or later (see `.nvmrc`)
- **npm** v10 or later
- **Deno** v1.x or later (for edge function development and type checking)
  ```bash
  # macOS/Linux
  curl -fsSL https://deno.land/install.sh | sh
  # Or via package managers
  brew install deno  # macOS
  ```
- **Docker Desktop** (optional, for local Supabase development)
- **GitHub account** with Personal Access Token (for GitHub API access)
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

> **🚀 For Local Development**: We recommend using the **consolidated migration approach** (`npm run db:setup` or `npm run supabase:migrate:consolidated`) which eliminates migration ordering issues. See [`supabase/migrations-local/README.md`](./supabase/migrations-local/README.md) for details.

### Writing New Migrations

### Working with Migrations

```bash
# Apply all migrations to local database
npm run supabase:reset

# Check migration status
npm run supabase:status

# Generate seed data for testing
npm run db:seed
npm run db:seed:quick  # Faster, smaller dataset
```

### Creating New Migrations

For schema changes, create new migration files with timestamps:

```bash
# Create new migration file
npx supabase migration new your_migration_name

# Write your SQL changes using idempotent patterns
CREATE TABLE IF NOT EXISTS your_table (...);
CREATE INDEX IF NOT EXISTS idx_name ON table(column);

# Test locally
npm run supabase:reset
```

### Best Practices

| Issue | Solution |
|-------|----------|
| Migration ordering issues | Use consolidated migration: `npm run supabase:migrate:consolidated` |
| "relation does not exist" errors | Switch to consolidated approach to avoid dependency issues |
| "auth schema not found" | Migration uses auth functions - wrap in conditional checks |
| "role does not exist" | Create roles conditionally before granting permissions |
| "extension not available" | Use IF NOT EXISTS and handle pg_cron specially |
| "multiple migration matches" | Migrations aren't idempotent - add IF EXISTS checks |

> **💡 Quick Fix**: Most local development migration issues are resolved by using our automated consolidated migration approach. Run `npm run db:setup` for a clean start.

For detailed documentation, see:

- Always use `IF EXISTS` / `IF NOT EXISTS` for idempotency
- Test migrations locally before pushing
- Keep migrations small and focused
- Document complex schema changes

**📚 Detailed Documentation:**
- [Database Migrations Guide](./docs/setup/DATABASE_MIGRATIONS.md)
- [Migration Scripts](./scripts/migrations/)
- [Supabase Setup](./docs/supabase/)
- [Local Migration Automation](./supabase/migrations-local/README.md) - Consolidated migration approach with troubleshooting


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

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token (classic) with these scopes:
   - `public_repo` - Access public repositories
   - `read:org` - Read organization data
   - `read:user` - Read user profile data
3. Copy the token and add it to your `.env.local` file as `VITE_GITHUB_TOKEN`

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
# Quick Start (Recommended for New Contributors)
npm run env:local        # Switch to local environment
npm run db:setup         # Complete database setup with consolidated migration
npm run dev              # Start development server

# Development
npm run dev              # Start Vite dev server (port 5173)
npm start                # Full stack: Vite + Netlify + Inngest
npm run build            # Type-check + build + copy CSP headers
npm run preview          # Preview production build

# Edge Functions (Deno-based)
npm run test:edge-functions           # Run edge function tests
npm run lint:edge-functions           # Lint edge functions
npm run format:edge-functions         # Format edge functions
npm run format:edge-functions:check   # Check edge function formatting

# Environment Management
npm run env:local        # Switch to local Supabase
npm run env:production   # Switch to production database


# Database Management (using npx, no global install needed)
npm run db:setup                    # Complete setup (start + consolidated migration)
npm run supabase:migrate:consolidated  # Use consolidated migration (recommended)
npm run supabase:migrate:local      # Basic local migration
npm run supabase:start              # Start local Supabase
npm run supabase:stop               # Stop local Supabase
npm run supabase:reset              # Reset database with migrations
npm run supabase:status             # Check Supabase status
npm run supabase:migrate            # Apply migrations

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix auto-fixable issues
npm run format:check     # Check Prettier formatting
npm run format           # Format all files
npm run typecheck        # TypeScript type checking
npm run verify:csp       # Verify CSP hash after HTML changes
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
- **Logging**: Use `logger` utility instead of `console.log` (see [Logging Guide](./docs/development/logging.md))

### 5. Component Guidelines

```typescript
import { logger } from '@/lib/logger';

// Use proper TypeScript interfaces
interface ContributorCardProps {
  contributor: ContributorStats;
  onSelect?: (contributor: ContributorStats) => void;
}

// Follow naming conventions
export function ContributorCard({ contributor, onSelect }: ContributorCardProps) {
  // Use logger instead of console.log (production-safe)
  logger.log('Rendering contributor card for %s', contributor.login);
  
  // Component logic
}

// Use custom hooks for data fetching
export function useContributorData(repoUrl: string) {
  logger.debug('Fetching contributor data for %s', repoUrl);
  // Hook implementation
}
```

**Logging Best Practices**:
- ✅ Use `logger.log()` instead of `console.log()` (only logs in dev)
- ✅ Use `logger.error()` for errors (always logs)
- ✅ Use printf-style formatting: `logger.log('User %s', userId)` not `` logger.log(`User ${userId}`) ``
- ❌ Don't use `console.log()` directly in production code
- 📚 See [Logging Guide](./docs/development/logging.md) for details

## 🧪 Testing

### Running Tests

```bash
# Unit Tests (Vitest)
npm test                 # Run all unit tests
npm run test:watch       # Watch mode
npm run test:ui          # Visual test runner

# E2E Tests (Playwright)
npm run test:e2e         # Run all E2E tests
npm run test:e2e:ui      # Interactive mode
npm run test:e2e:headed  # See browser

# Storybook Tests
npm run storybook        # Start dev server
npm run test-storybook   # Interaction tests
npm run test-storybook-a11y  # Accessibility tests
```

### Writing Tests

**Testing Philosophy**: Write simple, focused tests that run quickly and reliably.

#### Unit Tests (Vitest)

For utilities, hooks, and components:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContributorCard } from './contributor-card';

describe('ContributorCard', () => {
  it('displays contributor information', () => {
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
});
```

**Unit Test Guidelines**:
- Keep tests synchronous when possible
- Mock external dependencies (API calls, Supabase)
- Test one thing per test
- Use descriptive test names
- Place tests next to source files: `component.test.tsx`

#### E2E Tests (Playwright)

For critical user flows:

```typescript
import { test, expect } from '@playwright/test';

test('user can search for repositories', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  const searchInput = page.getByPlaceholder('Search repositories');
  await searchInput.fill('react');
  await searchInput.press('Enter');
  
  await expect(page.getByText('facebook/react')).toBeVisible();
});
```

**E2E Test Guidelines**:
- Focus on critical user paths only
- Keep tests stable and deterministic
- Use data-testid for reliable selectors
- Tests live in `e2e/` directory

#### Storybook Tests

For component interactions and accessibility:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'UI/Button',
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Clickable: Story = {
  args: { children: 'Click me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    
    await userEvent.click(button);
    await expect(button).toBeInTheDocument();
  },
};
```

**📚 Testing Documentation**:
- [Bulletproof Testing Guidelines](./docs/testing/BULLETPROOF_TESTING_GUIDELINES.md)
- [Testing Best Practices](./docs/testing/testing-best-practices.md)
- [E2E Testing Philosophy](./docs/testing/e2e-minimal-testing-philosophy.md)

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
   npm run build                  # Ensure it builds
   npm test                       # Run unit tests
   npm run test:edge-functions    # Run edge function tests (if modified)
   npm run test:e2e              # Run E2E tests (if UI changes)
   npm run lint                   # Check code style
   npm run typecheck              # Check TypeScript
   ```

   **Note**: If you modified edge functions in `supabase/functions/`, the pre-commit hook will automatically run Deno type checking. Ensure you have [Deno installed](#-prerequisites) to catch errors before CI.

### 3. Commit Guidelines

⚠️ **IMPORTANT: Never use `--no-verify`**

**DO NOT bypass pre-commit hooks:**
```bash
# ❌ NEVER do this
git commit --no-verify -m "quick fix"
git push --no-verify

# ✅ Always commit normally
git commit -m "fix: resolve type errors"
```

**Why pre-commit hooks matter:**
- TypeScript type checking catches errors before CI
- ESLint prevents code quality issues
- Prettier ensures consistent formatting
- CSP validation prevents security vulnerabilities

**If hooks fail:**
1. Read the error message - it tells you what's wrong
2. Fix the issue locally:
   ```bash
   npm run lint:fix        # Fix ESLint issues
   npx tsc -b --noEmit     # Check TypeScript
   npm run format          # Format code
   ```
3. Commit again (hooks will pass)

See [Pre-Commit Hooks Guide](./docs/development/pre-commit-hooks.md) for details.

**Use conventional commits:**
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
   - Use a clear, descriptive title following [Conventional Commits](https://www.conventionalcommits.org/)
   - Reference related issues: `Closes #123` or `Fixes #123`
   - Describe what changed and why
   - Include screenshots/videos for UI changes
   - Add test plan or testing notes

3. **PR Checklist**
   - [ ] All tests pass (`npm test`, `npm run test:edge-functions`, and `npm run test:e2e`)
   - [ ] Code follows project style (`npm run lint` passes)
   - [ ] TypeScript has no errors (`npm run typecheck`)
   - [ ] Edge functions pass Deno checks (automatic via pre-commit hook)
   - [ ] Build succeeds (`npm run build`)
   - [ ] Self-review completed
   - [ ] Documentation updated (if needed)
   - [ ] Screenshots added (for UI changes)

4. **Review Process**
   - CI checks must pass (build, tests, lint)
   - At least one maintainer approval required
   - Address review feedback promptly
   - Keep PR scope focused and manageable

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

### Setup & Development
- [Local Development Guide](./docs/setup/LOCAL_DEVELOPMENT.md) - Complete setup instructions
- [Windows Setup Guide](./docs/setup/WINDOWS_SETUP.md) - Windows-specific setup
- [Seed Data Guide](./docs/setup/SEED_DATA.md) - Generate test data

### Database & Supabase
- [Supabase Dev Setup](./docs/supabase/DEV_SETUP.md) - Database environment
- [Migration Guide](./docs/supabase/MIGRATION_GUIDE.md) - Schema changes
- [RLS Policies](./docs/supabase/RLS_POLICIES.md) - Security configuration
- [Supabase Quick Reference](./docs/supabase/QUICK_REFERENCE.md) - Common patterns

### Testing
- [Testing Best Practices](./docs/testing/testing-best-practices.md)
- [Bulletproof Testing Guidelines](./docs/testing/BULLETPROOF_TESTING_GUIDELINES.md)
- [E2E Testing Philosophy](./docs/testing/e2e-minimal-testing-philosophy.md)
- [Storybook Guide](./docs/testing/chromatic-readme.md)

### Architecture & Design
- [Architecture Overview](./docs/setup/ARCHITECTURE_2025-06-26.md)
- [Data Fetching Strategy](./docs/data-fetching/)
- [Performance Optimization](./docs/performance/)
- [Security Guidelines](./docs/security/)

## 🤝 Community & Support

- **[GitHub Discussions](https://github.com/bdougie/contributor.info/discussions)** - Ask questions, share ideas
- **[Issues](https://github.com/bdougie/contributor.info/issues)** - Report bugs, request features
- **[TRIAGE.md](./TRIAGE.md)** - How to pick up issues and get started
- **Pull Requests** - Contribute code improvements

### Getting Help

- Check existing [documentation](./docs/)
- Search [closed issues](https://github.com/bdougie/contributor.info/issues?q=is%3Aissue+is%3Aclosed)
- Ask in [Discussions](https://github.com/bdougie/contributor.info/discussions)
- Ping maintainers in your PR if stuck

## 📄 License

By contributing to Contributor.info, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Happy contributing!** 🎉 

If you have questions, don't hesitate to ask in our [Discussions](https://github.com/bdougie/contributor.info/discussions) or create an [Issue](https://github.com/bdougie/contributor.info/issues).

Thank you for helping make Contributor.info better for everyone! 🚀
