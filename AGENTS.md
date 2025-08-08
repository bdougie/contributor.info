# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript React app (components, hooks, lib, pages, styles). Tests colocated under `src/**/*.test.ts(x)` and `src/**/__tests__`.
- `app/`: App routes and static HTML entry points.
- `public/`: Static assets served by Vite.
- `e2e/`: Playwright end-to-end tests; reports in `playwright-report/`.
- `.storybook/` and `stories/`: Storybook config and stories.
- `scripts/`: Utility, CI, and performance scripts (e.g., sitemap, assets, testing tools).

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server.
- `npm start`: Dev with extras (Vite + Netlify Functions + Inngest). Useful for full local flows.
- `npm run build`: Type-check and build production bundle.
- `npm run preview`: Serve the built app locally.
- `npm test` / `npm run test:watch`: Run Vitest (unit/integration) once or in watch mode.
- `npm run test:e2e`: Run Playwright tests. Use `test:e2e:ui` to debug.
- `npm run storybook` / `npm run test-storybook`: Run Storybook and interaction tests.
- `npm run lint`: Lint with ESLint.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts/.tsx`); Node 20+ required.
- Indentation: 2 spaces; prefer single quotes; semicolons standard.
- React: Components in PascalCase (`RepositorySummaryCard.tsx`); hooks in `use-*` snake (`use-repo-data.ts`).
- Files: Keep module names descriptive and kebab-case for non-components (`progressive-loading.ts`).
- Formatting/Linting: ESLint (TS + React Hooks + Refresh). Run `npm run lint` before PRs.

## Testing Guidelines
- Unit: Vitest with JSDOM; place tests next to code (`*.test.tsx`). Some complex/mock-heavy tests are excluded in CI—prefer pure unit tests.
- E2E: Playwright in `e2e/`; single worker for stability. Start via `npm run test:e2e`.
- Storybook: Interaction and a11y tests via `test-storybook` and `test-storybook-a11y`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits enforced via commitlint. Examples: `feat: add repository summary card`, `fix(ui): correct tooltip position`.
- PRs: Link issues, describe changes and user impact, include screenshots for UI updates, and note test coverage. Ensure `npm test && npm run lint && npm run build` pass.

## Security & Configuration
- Env: Copy `.env.example` to `.env`. Do not commit secrets. Common vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Dependencies and Node: Use `npm ci` on CI; local Node ≥ 20 (`.nvmrc` provided).
