# [API Name] API

## Overview

Brief description of what this API/hook does and its purpose.

## Import

```typescript
import { useYourHook } from '@/hooks/use-your-hook';
// or
import { yourService } from '@/lib/services/your-service';
```

## Signature

```typescript
function useYourHook(
  param1: Type1,
  options?: Options
): ReturnType;
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| param1 | `Type1` | Yes | Description of param1 |
| options | `Options` | No | Configuration options |

### Options

```typescript
interface Options {
  option1?: string;  // Description
  option2?: boolean; // Description
  onSuccess?: (data: Data) => void; // Callback on success
  onError?: (error: Error) => void; // Callback on error
}
```

### Return Value

```typescript
interface ReturnType {
  data: Data | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## Usage Examples

### Basic Example

```typescript
function MyComponent() {
  const { data, loading, error } = useYourHook('param-value');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data?.value}</div>;
}
```

### With Options

```typescript
function MyComponent() {
  const { data, refetch } = useYourHook('param-value', {
    option1: 'value',
    onSuccess: (data) => {
      console.log('Success!', data);
    },
    onError: (error) => {
      console.error('Failed:', error);
    }
  });

  return (
    <div>
      <div>{data?.value}</div>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### Advanced Pattern

```typescript
// Example of a more complex usage pattern
function AdvancedComponent() {
  const [param, setParam] = useState('initial');

  const { data, loading, refetch } = useYourHook(param, {
    option1: 'value',
    option2: true
  });

  useEffect(() => {
    if (data) {
      // Do something with data
    }
  }, [data]);

  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
}
```

## API Behavior

### Caching

Explain any caching behavior, if applicable.

### Error Handling

Explain how errors are handled and what errors might be thrown.

### Side Effects

List any side effects this API has (network calls, local storage, etc).

## Best Practices

- ✅ **DO**: Use this hook when...
- ✅ **DO**: Always handle loading and error states
- ❌ **DON'T**: Call this in loops or conditionally
- ❌ **DON'T**: Use this if you need...

## Common Patterns

### Pattern 1: [Scenario]

```typescript
// Example code for common pattern
```

### Pattern 2: [Another Scenario]

```typescript
// Example code for another pattern
```

## Troubleshooting

### Problem: Hook returns null

**Cause**: Usually means the data hasn't loaded yet or there's no data.

**Solution**: Always check loading state before accessing data.

### Problem: [Another Issue]

**Cause**: Why this happens.

**Solution**: How to fix it.

## Related

- Related hooks/APIs
- Architecture documentation
- Related features
