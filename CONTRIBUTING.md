# Contributing to Contributor.info

Thank you for your interest in contributing to Contributor.info! This guide will help you get started with development, testing, and submitting contributions.

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
   - See [Database Setup](#database-setup) for Supabase configuration
   - See [Environment Variables](#environment-variables) for required config

4. **Start developing**
   ```bash
   npm run dev
   ```
For a complete guide to setting up your local development environment, please see our **[Local Development Setup Guide](./docs/setup/LOCAL_DEVELOPMENT.md)**.

## 📋 Prerequisites

- **Node.js** (v18 or later)
- **npm** or **yarn**
- **Docker Desktop** (for local database development)
- **GitHub account** with Personal Access Token
- **Supabase account** (for authentication and database)

## 🗄️ Database Setup

Contributor.info uses Supabase for its database and authentication. We provide several options for development:

### Option 1: Local Supabase (Recommended)

For the safest development experience, run Supabase locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase stack
supabase start

# Apply database migrations
supabase db push

# Load test data
supabase db seed seed.sql
```

**📚 Detailed Setup Guides:**
- **[Development Setup Guide](./supabase/DEV_SETUP.md)** - Complete local environment setup
- **[Migration Guide](./supabase/MIGRATION_GUIDE.md)** - Database migration instructions
- **[Supabase Documentation](./supabase/README.md)** - Comprehensive database documentation

### Option 2: Development Project

Create a separate Supabase project for development:
1. Create new project at [supabase.com](https://supabase.com/dashboard)
2. Follow instructions in [DEV_SETUP.md](./supabase/DEV_SETUP.md#option-2-supabase-development-project)

### Database Schema

Our database includes:
- **Contributors** - GitHub user profiles and statistics
- **Repositories** - Tracked repository information
- **Pull Requests** - PR data with code changes
- **Reviews & Comments** - PR feedback and discussion
- **Monthly Rankings** - Contributor leaderboards
- **Analytics Tables** - Activity tracking and insights

## 🔧 Environment Variables

Create a `.env.local` file in the root directory:

```env
# GitHub API (required)
VITE_GITHUB_TOKEN=ghp_your_github_personal_access_token

# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:54321  # for local development
VITE_SUPABASE_ANON_KEY=your_local_anon_key

# Optional: OpenAI for insights features
OPENAI_API_KEY=your_openai_api_key
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
│   ├── migrations/         # Database migrations
│   ├── functions/          # Edge functions
│   ├── DEV_SETUP.md       # Development setup guide
│   └── README.md          # Database documentation
└── tasks/                  # Project planning documents
```

### 2. Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with UI

# Database (requires Supabase CLI)
supabase start           # Start local database
supabase db push         # Apply migrations
supabase db reset        # Reset database
supabase db seed seed.sql # Load test data
```

### 3. Code Style and Standards

- **TypeScript**: Strict mode enabled, use proper types
- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS with shadcn/ui components
- **Testing**: Vitest for unit tests, Testing Library for components
- **Linting**: ESLint with React and TypeScript rules

### 4. Component Guidelines

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
   ```

2. **Make your changes**
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run build    # Ensure it builds
   npm test         # Run tests
   npm run lint     # Check code style
   ```

4. **Test with database changes**
   ```bash
   supabase db reset     # Reset local database
   supabase db push      # Apply your migrations
   # Test your feature thoroughly
   ```

### 3. Commit Guidelines

Use conventional commits:
```bash
feat: add contributor search functionality
fix: resolve avatar loading issue
docs: update setup instructions
test: add contributor card tests
```

### 4. Pull Request Process

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**
   - Use a descriptive title
   - Reference related issues with `Closes #123`
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

## 📚 Additional Resources

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
