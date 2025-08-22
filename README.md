# contributor.info

A web application that visualizes GitHub repository contributors' information, providing insights into pull requests, contributions, and contributor details.

## Project Stats

[![Contributors](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=contributors&style=flat)](https://contributor.info/bdougie/contributor.info)
[![Pull Requests](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=pull-requests&style=flat)](https://contributor.info/bdougie/contributor.info)
[![Merge Rate](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=merge-rate&style=flat)](https://contributor.info/bdougie/contributor.info)

[![Contributor Stats](https://contributor.info/api/widgets/stat-card?owner=bdougie&repo=contributor.info&theme=light&size=medium)](https://contributor.info/bdougie/contributor.info)

_https://contributor.info/widgets_

## ✨ Features

- **GitHub Authentication** - Secure OAuth integration
- **Repository Analysis** - Deep-dive into any public GitHub repository
- **Contributor Insights** - Detailed profiles and contribution statistics
- **Pull Request Analytics** - Comprehensive PR analysis and trends
- **Contributor Rankings** - Monthly leaderboards and scoring
- **Organization Tracking** - Team and company affiliation insights
- **Real-time Data** - Live updates from GitHub API
- **Beautiful UI** - Responsive design with dark/light mode
- **Embeddable Widgets** - Share repository stats in your README
- **Long-Running Sync Support** - Process large repositories (pytorch/pytorch) without timeouts using Supabase Edge Functions

## 🚀 Quick Start

1. **Visit the app**: [contributor.info](https://contributor.info)
2. **Sign in** with your GitHub account
3. **Search** for any public repository
4. **Explore** contributor insights and analytics

## 📊 Embeddable Widgets

Display repository statistics directly in your README with our embeddable widgets!

### Live Examples

#### Contributor Badge
[![Contributors](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=contributors&style=flat)](https://contributor.info/bdougie/contributor.info)
[![Pull Requests](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=pull-requests&style=flat)](https://contributor.info/bdougie/contributor.info)
[![Merge Rate](https://contributor.info/api/widgets/badge?owner=bdougie&repo=contributor.info&type=merge-rate&style=flat)](https://contributor.info/bdougie/contributor.info)

#### Stat Card
[![Contributor Stats](https://contributor.info/api/widgets/stat-card?owner=bdougie&repo=contributor.info&theme=light&size=medium)](https://contributor.info/bdougie/contributor.info)

### How to Use

1. **Choose a widget type**: Badge or Stat Card
2. **Customize the parameters**:
   - `owner`: Repository owner
   - `repo`: Repository name
   - `type`: Metric type (contributors, pull-requests, merge-rate, lottery-factor)
   - `style`: Badge style (flat, flat-square, plastic, social)
   - `theme`: Card theme (light, dark, auto)
   - `size`: Card size (small, medium, large)

3. **Embed in your README**:
```markdown
[![Contributors](https://contributor.info/api/widgets/badge?owner=YOUR_ORG&repo=YOUR_REPO&type=contributors&style=flat)](https://contributor.info/YOUR_ORG/YOUR_REPO)
```

Visit [contributor.info/widgets](https://contributor.info/widgets) to generate custom widgets for your repository!

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

## 🏗 Architecture

### Hybrid Sync System

The application uses an intelligent hybrid routing system to handle repository syncs without timeouts:

```
┌─────────────────────────────────────┐
│           User Interface            │
│     React + TypeScript + Vite      │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│        Sync Service Router          │
│   (Intelligent Request Routing)     │
│  ┌─────────────┐  ┌───────────────┐ │
│  │  Quick Ops  │  │  Long-Running │ │
│  │  (<10 sec)  │  │   (>30 sec)   │ │
│  └──────┬──────┘  └───────┬───────┘ │
└─────────┼──────────────────┼─────────┘
          ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│ Netlify Functions│  │ Supabase Edge  │
│   + Inngest     │  │   Functions     │
│  (10-26s limit) │  │ (150s limit)   │
└────────┬────────┘  └───────┬─────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────┐
│         Supabase Database           │
│    (PostgreSQL + Realtime + RLS)    │
└─────────────────────────────────────┘
```

**Key Features:**
- **Automatic Routing**: Detects large repositories and routes to appropriate service
- **No Timeouts**: Large repos like `pytorch/pytorch` sync completely
- **Resumable Syncs**: Can continue from where it left off
- **Performance Monitoring**: Tracks execution times and success rates

## ⚡ Tech Stack

**Frontend**
- React + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Recharts (data visualization)

**Backend & Data**
- Supabase (database & auth)
- GitHub API (real-time data)
- Netlify Functions (quick operations <26s)
- Supabase Edge Functions (long operations <150s)
- [gh-datapipe](https://github.com/open-source-ready/gh-datapipe) (massive historical imports, no limits)

**Development**
- Vitest (testing) - [Testing Guide](./docs/testing/README.md)
- ESLint (code quality)
- GitHub Actions (CI/CD)

**Infrastructure**
- Performance Monitoring ([see guide](./docs/dev/performance-monitoring.md))
- Edge Functions
- CDN Analytics

## License

[MIT License](LICENSE)# Force rebuild
