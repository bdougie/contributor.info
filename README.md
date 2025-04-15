# contributor.info

A web application that visualizes GitHub repository contributors' information, providing insights into pull requests, contributions, and contributor details.

## Project Overview

contributor.info is a React TypeScript application that connects to the GitHub API to fetch repository data and displays meaningful information about contributors. The application uses Supabase for authentication and data storage.

## Features

- GitHub authentication
- Repository search and visualization
- Pull request analysis
- Contributor profile details
- Organization affiliation display
- Dark/light mode toggle
- Responsive UI built with Radix UI components and Tailwind CSS

## Project Structure

```
contributor.info/
├── public/              # Static assets
├── src/                 # Application source code
│   ├── components/      # React components
│   │   ├── ui/          # UI components (buttons, cards, etc.)
│   │   └── ...          # Feature components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and API clients
│   │   ├── github.ts    # GitHub API integration
│   │   ├── supabase.ts  # Supabase client setup
│   │   ├── types.ts     # TypeScript type definitions
│   │   └── utils.ts     # Helper utilities
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── .env                 # Environment variables (git-ignored)
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## Architecture Diagram

```
┌─────────────────────────────────────┐
│           User Interface            │
│  ┌─────────────┐    ┌─────────────┐ │
│  │   Auth UI   │    │  Repository │ │
│  │  Components │    │     View    │ │
│  └─────────────┘    └─────────────┘ │
└───────────┬─────────────────┬───────┘
            │                 │
            ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│    Supabase     │  │    GitHub API   │
│  Authentication │  │    Integration  │
│    & Storage    │  │                 │
└─────────────────┘  └─────────────────┘
```

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- GitHub account (for API access)
- Supabase account (for authentication and storage)

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```
VITE_GITHUB_TOKEN=your_github_personal_access_token
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Local Development

1. Clone the repository:

```bash
git clone https://github.com/yourusername/contributor.info.git
cd contributor.info
```

2. Install dependencies:

```bash
npm install
# or
yarn
```

3. Start the development server:

```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Build for Production

To build the application for production:

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

## Preview Production Build

To preview the production build locally:

```bash
npm run preview
# or
yarn preview
```

## Linting

To lint your code:

```bash
npm run lint
# or
yarn lint
```

## Project Configuration

- **TypeScript**: Configured in `tsconfig.json` and `tsconfig.app.json`
- **Vite**: Build tool configuration in `vite.config.ts`
- **Tailwind CSS**: Styling configuration in `tailwind.config.js`
- **ESLint**: Code linting rules in `eslint.config.js`

## Technologies Used

- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Supabase**: Backend as a Service for authentication and storage
- **GitHub API**: Data source for repository and contributor information
- **React Router**: Client-side routing
- **React Hook Form**: Form handling
- **Zod**: Schema validation
- **Recharts**: Charting library for data visualization

## License

[MIT License](LICENSE)
