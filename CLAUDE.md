# Claude Development Guidelines

See [AGENTS.md](./AGENTS.md) for project overview, architecture, and contributing conventions.

<critical>
    Never write env variables inline into scripts. Especially SUPABASE tokens keys and urls.
    Delete scripts that are not referenced anywhere and are one-time use.
</critical>

## Build Commands

```bash
npm run build
```

Checks TypeScript types and builds the production bundle.

## Development Rules

- never use jest. only vitest
- never use "any" types in typescript - always create proper interfaces/types
- never use "unknown" as a lazy fix - define real types
- `console.log(\`${owner}\`)` is a security vulnerability. Use `console.log('%s', owner)`
- use the supabase mcp server for migrations
- use bulletproof testing practices, e2e tests only when necessary
- check `/docs/testing/BULLETPROOF_TESTING_GUIDELINES.md` before fixing tests
- if you touch the file, make it better - don't just disable the linter
- after visual changes always look for opportunity to improve performance
- no premature optimizations without testing
- scripts need to be documented and organized into folders/readmes
- ES module patterns only - no require() calls
