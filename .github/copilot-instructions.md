# GitHub Copilot Instructions for contributor.info

This document provides guidance for GitHub Copilot when assisting with the contributor.info project.

## Package Management Instructions

### Use npm instead of yarn

This project is primarily configured to use npm for package management. When suggesting commands, please use npm commands instead of yarn equivalents.

| Preferred (npm) | Avoid (yarn) |
|-----------------|--------------|
| `npm install` | `yarn` or `yarn install` |
| `npm run build` | `yarn build` |
| `npm run dev` | `yarn dev` |
| `npm run test` | `yarn test` |
| `npm run lint` | `yarn lint` |
| `npm run preview` | `yarn preview` |

Example: When suggesting how to build the project, use:
```bash
npm run build
```

### Installing dependencies

When adding new dependencies, use npm:

```bash
# Adding production dependencies
npm install package-name

# Adding development dependencies 
npm install --save-dev package-name
```

## Project Structure and Code Style

When generating or modifying code for this project, please follow these guidelines:

1. Use TypeScript for all new files
2. Follow the existing component structure and patterns
3. Use Radix UI components where appropriate
4. Use Tailwind CSS for styling
5. Follow the existing naming conventions throughout the codebase

## Type Definitions

- Place shared interface/type definitions in `src/lib/types.ts`
- Ensure types are properly exported and imported where needed
- Use precise typing and avoid `any` where possible

## Testing

When writing tests:

- Use Vitest for testing
- Place test files in `__tests__` directories alongside the code being tested
- Follow the existing testing patterns in the project

## Suggested Commands for Common Tasks

- Start development server: `npm run dev`
- Run tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`
- Build the project: `npm run build`
- Preview the production build: `npm run preview`
- Lint the codebase: `npm run lint`

## GitHub API and Supabase Usage

When working with the GitHub API or Supabase functionality:

- Use the existing utility functions and hooks where possible
- Follow the established patterns for data fetching and state management
- Be mindful of GitHub API rate limits in your implementation suggestions