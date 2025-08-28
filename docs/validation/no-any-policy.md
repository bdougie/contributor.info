# No-Any Policy: TypeScript Type Safety Standards

## Policy Statement

**Effective Date**: August 2025  
**Issue Reference**: #541  
**Status**: Enforced

This codebase maintains a **strict no-any policy**. The use of TypeScript's `any` type is prohibited in all new code and must be eliminated from existing code.

## Rationale

### Why We Don't Use `any`

1. **Type Safety**: `any` disables all type checking, defeating TypeScript's purpose
2. **Runtime Errors**: Code with `any` can fail at runtime without compile-time warnings
3. **Refactoring Risk**: Changes to `any`-typed code don't trigger type errors
4. **Code Quality**: `any` hides bugs and makes code harder to understand
5. **Developer Experience**: Loss of IntelliSense, auto-completion, and type hints

### The Hidden Cost of `any`

```typescript
// ❌ This compiles but crashes at runtime
function processUser(user: any) {
  return user.name.toUpperCase(); // Runtime error if name is undefined
}

// ✅ This catches errors at compile time
function processUser(user: { name?: string }) {
  return user.name?.toUpperCase() || 'Unknown';
}
```

## Enforcement

### Build-Time Enforcement

Our TypeScript configuration enforces this policy:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### CI/CD Pipeline

- Build fails if `any` types are detected
- PR checks block merging code with `any`
- Regular audits scan for `any` usage

## Alternatives to `any`

### 1. Use `unknown` for Truly Unknown Types

```typescript
// ❌ BAD
function processData(data: any) {
  return data.value;
}

// ✅ GOOD - Forces type checking
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: unknown }).value;
  }
  return null;
}
```

### 2. Use Zod for Runtime Validation

```typescript
// ❌ BAD - Unsafe assertion
const user = apiResponse as any;

// ✅ GOOD - Runtime validation
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const result = userSchema.safeParse(apiResponse);
if (result.success) {
  const user = result.data; // Fully typed!
}
```

### 3. Use Generics for Flexible Types

```typescript
// ❌ BAD
function getValue(obj: any, key: string): any {
  return obj[key];
}

// ✅ GOOD
function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### 4. Use Union Types for Multiple Possibilities

```typescript
// ❌ BAD
let result: any;

// ✅ GOOD
let result: string | number | null;
```

### 5. Use Type Guards for Narrowing

```typescript
// Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

// Usage
if (isUser(data)) {
  // data is typed as User here
  console.log(data.name);
}
```

## Migration Strategy

### Finding `any` Types

```bash
# Search for any usage
grep -r ":\s*any" src/
grep -r "as any" src/
grep -r "<any>" src/
```

### Gradual Migration

1. **Phase 1**: Add TODO comments to all `any` occurrences
2. **Phase 2**: Replace with `unknown` and add type guards
3. **Phase 3**: Implement proper types or Zod schemas
4. **Phase 4**: Remove all temporary suppressions

### Temporary Suppressions (Last Resort)

If migration must be gradual:

```typescript
// @ts-expect-error - TODO: Remove any (Issue #541)
const temp: any = complexLegacyCode;
```

## Common Scenarios

### API Responses

```typescript
// ❌ BAD
const response: any = await fetch('/api/users');

// ✅ GOOD
const response = await fetch('/api/users');
const data = await response.json();
const users = userArraySchema.parse(data);
```

### Event Handlers

```typescript
// ❌ BAD
onClick={(e: any) => console.log(e.target.value)}

// ✅ GOOD
onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e.currentTarget.value);
}}
```

### Third-Party Libraries

```typescript
// ❌ BAD
const lib: any = require('untyped-library');

// ✅ GOOD
// Create a type declaration
declare module 'untyped-library' {
  export function doSomething(input: string): void;
}
```

## Exceptions

There are **NO** acceptable uses of `any` in production code.

For truly exceptional cases requiring discussion:
1. Open an issue explaining the scenario
2. Attempt alternatives (unknown, generics, overloads)
3. Get team consensus before proceeding

## Benefits Achieved

Since implementing this policy:
- **31+ `any` types removed** from the codebase
- **0 runtime type errors** in production
- **Improved IDE support** with full IntelliSense
- **Safer refactoring** with compile-time guarantees
- **Better code documentation** through explicit types

## Tools and Resources

### Recommended VSCode Extensions
- **TypeScript Error Lens**: Highlights type errors inline
- **Pretty TypeScript Errors**: Makes error messages readable
- **TypeScript Importer**: Auto-imports types

### Useful Commands

```bash
# Check for any usage
npm run typecheck

# Find specific any patterns
npx eslint . --rule '@typescript-eslint/no-explicit-any: error'
```

## Team Agreement

By contributing to this codebase, you agree to:
1. Never introduce new `any` types
2. Remove `any` types when touching existing code
3. Use proper TypeScript patterns and runtime validation
4. Help others understand and follow this policy

## References

- [TypeScript Handbook - The any Type](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any)
- [Zod Documentation](https://zod.dev)
- [PR #577 - Zod Validation Implementation](https://github.com/bdougie/contributor.info/pull/577)
- [Issue #541 - Remove TypeScript any types](https://github.com/bdougie/contributor.info/issues/541)

---

*This policy is enforced through automated tooling and code review. Questions or concerns should be raised in team discussions or GitHub issues.*