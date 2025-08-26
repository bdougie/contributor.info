# Linting and Code Formatting Guide

This guide provides detailed information about the project's linting and formatting setup.

## Overview

The project uses a combination of tools to maintain code quality and consistency:

- **ESLint** - Static code analysis for JavaScript/TypeScript
- **Prettier** - Opinionated code formatter
- **Husky** - Git hooks management
- **lint-staged** - Run linters on staged Git files

## Installation

Dependencies are automatically installed when you run:

```bash
npm install
```

## Configuration

### ESLint Configuration (`.eslintrc.cjs`)

The project extends several ESLint configurations:

- TypeScript recommended rules
- React hooks rules
- React refresh rules

Key rules enforced:

- **No `any` types**: All TypeScript types must be properly defined
- **No unused variables**: Variables must be used or prefixed with `_`
- **No nested ternaries**: Avoid complex nested conditional expressions
- **Prefer `.maybeSingle()`**: For Supabase queries that might not return results

### Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Files Ignored (`.prettierignore`)

The following are excluded from formatting:

- `node_modules/`
- `dist/`, `build/`
- Generated files (sitemaps, minified files)
- Lock files (`package-lock.json`, etc.)
- Database files (`.sql`)

## Pre-commit Hooks

### How It Works

1. When you run `git commit`, Husky triggers the pre-commit hook
2. lint-staged runs on all staged files
3. For TypeScript/JavaScript files:
   - ESLint checks for errors
   - Prettier formats the code
4. For JSON/Markdown/YAML files:
   - Prettier formats the files
5. If there are unfixable errors, the commit is blocked

### Bypassing Hooks (Use Sparingly)

If you need to commit despite linting errors:

```bash
git commit --no-verify -m "your message"
```

⚠️ **Warning**: Only use this for emergency fixes. Always fix linting issues afterward.

## Common Commands

### Check for Issues

```bash
# Run ESLint on all files
npm run lint

# Check specific files
npx eslint src/components/MyComponent.tsx

# Check with auto-fix preview
npx eslint --fix --dry-run src/
```

### Fix Issues

```bash
# Auto-fix all fixable issues and format code
npm run lint:fix

# Fix specific file
npx eslint --fix src/components/MyComponent.tsx

# Format with Prettier
npx prettier --write "src/**/*.{ts,tsx}"
```

## Common Linting Issues and Solutions

### 1. TypeScript `any` Types

**Error**: `Unexpected any. Specify a different type`

**Solution**: Replace with proper types

```typescript
// ❌ Bad
const data: any = fetchData();

// ✅ Good
interface UserData {
  id: string;
  name: string;
}
const data: UserData = fetchData();

// ✅ When type is truly unknown
const data: unknown = fetchData();
```

### 2. Unused Variables

**Error**: `'variable' is assigned a value but never used`

**Solution**: Remove or prefix with underscore

```typescript
// ❌ Bad
const unused = getSomething();

// ✅ Good - if intentionally unused
const _unused = getSomething();

// ✅ Better - remove if not needed
// Line removed
```

### 3. Nested Ternary Expressions

**Error**: `Do not nest ternary expressions`

**Solution**: Refactor to if/else or separate variables

```typescript
// ❌ Bad
const result = condition1 ? value1 : condition2 ? value2 : value3;

// ✅ Good
const result = (() => {
  if (condition1) return value1;
  if (condition2) return value2;
  return value3;
})();

// ✅ Alternative
let result;
if (condition1) {
  result = value1;
} else if (condition2) {
  result = value2;
} else {
  result = value3;
}
```

### 4. Supabase `.single()` Usage

**Error**: `Use .maybeSingle() instead of .single()`

**Solution**: Replace for safer queries

```typescript
// ❌ Bad - throws error if no rows found
const { data, error } = await supabase.from('users').select().eq('id', userId).single();

// ✅ Good - returns null if no rows found
const { data, error } = await supabase.from('users').select().eq('id', userId).maybeSingle();
```

## IDE Integration

### VS Code

Install these extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

Add to your VS Code settings:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"]
}
```

### WebStorm / IntelliJ

1. Go to Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. Enable "Automatic ESLint configuration"
3. Enable "Run eslint --fix on save"

## Troubleshooting

### Pre-commit Hook Not Running

```bash
# Reinstall Husky
npx husky install
```

### ESLint Not Finding Config

```bash
# Clear cache
npx eslint --cache-location node_modules/.cache/eslint/ --cache --ext .ts,.tsx src/
```

### Prettier Conflicts with ESLint

The project is configured to avoid conflicts, but if issues arise:

```bash
# Check for conflicting rules
npx eslint-config-prettier src/components/MyComponent.tsx
```

## Best Practices

1. **Fix as you go**: Don't accumulate linting debt
2. **Run before PR**: Always run `npm run lint` before creating a PR
3. **Use IDE integration**: Get real-time feedback while coding
4. **Understand the rules**: Don't just auto-fix blindly
5. **Document exceptions**: If you must disable a rule, add a comment explaining why

## Contributing

When contributing to the linting setup:

1. Discuss major rule changes in an issue first
2. Test thoroughly - rule changes affect the entire codebase
3. Document new rules in this guide
4. Consider adding custom rules for project-specific patterns

## Resources

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
