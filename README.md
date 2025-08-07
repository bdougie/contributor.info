# contributor.info

A web application that visualizes GitHub repository contributors' information, providing insights into pull requests, contributions, and contributor details.

## ✨ Features

- **GitHub Authentication** - Secure OAuth integration
- **Repository Analysis** - Deep-dive into any public GitHub repository
- **Contributor Insights** - Detailed profiles and contribution statistics
- **Pull Request Analytics** - Comprehensive PR analysis and trends
- **Contributor Rankings** - Monthly leaderboards and scoring
- **Organization Tracking** - Team and company affiliation insights
- **Real-time Data** - Live updates from GitHub API
- **Beautiful UI** - Responsive design with dark/light mode

## 🚀 Quick Start

1. **Visit the app**: [contributor.info](https://contributor.info)
2. **Sign in** with your GitHub account
3. **Search** for any public repository
4. **Explore** contributor insights and analytics

## 🛠️ For Contributors

Want to contribute to the project? We'd love your help!

**👉 [See CONTRIBUTING.md](./CONTRIBUTING.md) for complete setup instructions**

The contributing guide includes:
- Development environment setup
- Database configuration with Supabase
- Local development workflow
- Testing guidelines
- Code contribution process

## 🧪 Testing

The project uses a comprehensive testing strategy with focus on isolated, pure unit tests. For detailed information, see our [Testing Documentation](./docs/testing/README.md).

**Quick Commands:**
```bash
npm test          # Run all tests (pure unit tests only)
npm run test:watch # Run tests in watch mode
npm run test:ui   # Open Vitest UI
```

**Testing Resources:**
- [Testing Strategy & Philosophy](./docs/testing/README.md)
- [Test Isolation Solution](./docs/test-isolation-solution.md) - How we fixed hanging tests
- [Mock Isolation Fix](./docs/MOCK_ISOLATION_FIX.md) - Technical details of the fix
- [E2E Testing Guide](./docs/testing/e2e-minimal-testing-philosophy.md)
- [Performance Monitoring](./docs/testing/performance-monitoring.md)
- [Release Process](./docs/testing/release-process.md)

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│           User Interface            │
│     React + TypeScript + Vite      │
│  ┌─────────────┐    ┌─────────────┐ │
│  │   Auth UI   │    │  Repository │ │
│  │  Components │    │   Analytics │ │
│  └─────────────┘    └─────────────┘ │
└───────────┬─────────────────┬───────┘
            │                 │
            ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│    Supabase     │  │    GitHub API   │
│  Authentication │  │   Real-time     │
│   & Database    │  │     Data        │
└─────────────────┘  └─────────────────┘
```

## ⚡ Tech Stack

**Frontend**
- React + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Recharts (data visualization)

**Backend & Data**
- Supabase (database & auth)
- GitHub API (real-time data)
- Edge Functions (serverless)

**Development**
- Vitest (testing) - [Testing Guide](./docs/testing/README.md)
- ESLint (code quality)
- GitHub Actions (CI/CD)

**Infrastructure**
- Performance Monitoring ([see guide](./docs/dev/performance-monitoring.md))
- Edge Functions
- CDN Analytics

## License

[MIT License](LICENSE)