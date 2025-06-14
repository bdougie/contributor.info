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
- Vitest (testing)
- ESLint (code quality)
- GitHub Actions (CI/CD)

## License

[MIT License](LICENSE)
