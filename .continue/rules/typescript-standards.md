# TypeScript Standards

## Type Safety

- **NEVER use `any` type** - Always create proper interfaces/types for data structures
- **NEVER use `unknown` as a lazy fix** - Define real types for resilience and maintainability
- All function parameters must have explicit types
- All function return types should be explicit
- Use strict TypeScript configuration

## Examples

### ❌ Bad
```typescript
function processData(data: any) {
  return data.map((item: any) => item.value);
}
```

### ✅ Good
```typescript
interface DataItem {
  value: string;
  id: number;
}

function processData(data: DataItem[]): string[] {
  return data.map((item) => item.value);
}
```

## Review Checklist

- [ ] No `any` types used
- [ ] No `unknown` used as lazy fix
- [ ] Proper interfaces/types defined
- [ ] Function parameters typed
- [ ] Return types explicit
