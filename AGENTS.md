# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (components, hooks, pages, lib, services, utils). Aliases: `@` → `src`.
- Tests: unit in `src/**/*.test.ts(x)` and `src/__tests__/`; e2e in `e2e/` (Playwright).
- Stories: `.storybook/` config, stories under `src/stories/`.
- Assets & static: `public/` (served) and `dist/` (build output).
- Server/automation: `app/` (webhooks, services), `scripts/` (build, perf, sitemap).

## Build, Test, and Development Commands
- Install: `npm ci` (Node ≥ 20; see `.nvmrc`).
- Dev app: `npm run dev` (Vite). Full stack: `npm start` (Vite + Netlify + Inngest).
- Build: `npm run build` (type-check + Vite + CSP headers copy).
- Preview: `npm run preview` (serve production build).
- Unit tests: `npm test` or `npm run test:unit` (Vitest, jsdom; coverage disabled).
- E2E tests: `npm run test:e2e` (Playwright; spins dev/preview as needed).
- Storybook: `npm run storybook`, test with `npm run test-storybook` or `:a11y`.
- Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format:check`.

## Coding Style & Naming Conventions
- Languages: TypeScript + React. Prefer strict typing; avoid `any`.
- Prettier: 2 spaces, single quotes, semicolons, width 100.
- ESLint: React hooks rules, no nested ternaries, prefer multiline ternaries.
- Supabase: use `.maybeSingle()` (not `.single()`).
- Filenames: kebab-case for files/dirs; React component identifiers PascalCase.
- Tests: `*.test.ts`/`*.test.tsx`. Stories: `*.stories.tsx`.

## Testing Guidelines
- Unit tests use Vitest (jsdom). Place near code or in `src/__tests__/`.
- Keep tests isolated; avoid global mocks unless essential.
- E2E lives in `e2e/` with Playwright; target `http://localhost:5173` locally.
- Storybook interaction/a11y tests run against `storybook-static`.

## Commit & Pull Request Guidelines
- Conventional Commits enforced by Commitlint. Examples:
  - `feat(ui): add repository summary card`
  - `fix(api): handle 406 with maybeSingle`
- Pre-commit runs lint-staged; install hooks: `npm run hooks:install`.
- PRs: include scope/summary, linked issues, screenshots for UI, test plan, and pass CI (lint, build, tests).

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- After editing `index.html` or `public/_headers`, run `npm run verify:csp`.
- Netlify config: `netlify.toml`; Lighthouse/perf scripts under `scripts/`.
