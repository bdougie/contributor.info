---
globs: "**/*.{ts,tsx}"
description: Never use 'any' type in TypeScript
---

# TypeScript Type Safety

Never use `any` types in TypeScript. All variables, parameters, and return types should be properly typed. If you need a flexible type, use `unknown` and add proper type guards, or define a proper union/interface type.

## Examples

❌ **Bad:**
```typescript
function processData(data: any) {
  return data.value;
}
```

✅ **Good:**
```typescript
interface DataObject {
  value: string;
}

function processData(data: DataObject) {
  return data.value;
}
```

✅ **Good (when type is truly unknown):**
```typescript
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data structure');
}
```