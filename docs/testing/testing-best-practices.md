# Testing Best Practices

## The Problem: Flaky Tests and Mock Hell

We've experienced significant issues with flaky tests that fail when run together but pass in isolation. The root cause was:

1. **Tight coupling** - Components directly importing external UI libraries (lucide-react, @/components/ui/*)
2. **Mock conflicts** - Different test files mocking the same modules differently
3. **Test contamination** - Mocks from one test affecting another
4. **Whack-a-mole fixes** - Constantly adding new mocks as components evolve

## The Solution: Separation of Concerns

### 1. Extract Business Logic

Move all business logic into pure functions in separate files:

```typescript
// src/lib/contributor-empty-state-config.ts
export function getEmptyStateContent(
  type: EmptyStateType,
  customMessage?: string,
  customSuggestion?: string
): EmptyStateContent {
  // Pure function - no React, no external dependencies
  switch (type) {
    case "no_data":
      return {
        iconName: "users",
        title: "No Contributor Data Available",
        // ...
      };
  }
}
```

**Benefits:**
- Unit test without any mocking
- Fast test execution
- Easy to reason about
- Reusable across components

### 2. Create Simple Presentational Components

Build components that accept all dependencies as props:

```typescript
// src/components/features/contributor/contributor-empty-state-simple.tsx
interface EmptyStateProps {
  type: EmptyStateType;
  message?: string;
  // Inject icon renderer instead of importing from lucide-react
  renderIcon?: (iconName: string, iconColor: string) => React.ReactNode;
}

export function ContributorEmptyStateSimple({ 
  type, 
  renderIcon 
}: EmptyStateProps) {
  const content = getEmptyStateContent(type);
  
  // Use injected renderer or fallback
  const iconRenderer = renderIcon || ((name) => <div>{name}</div>);
  
  return (
    <div role={content.severity === "error" ? "alert" : "status"}>
      {iconRenderer(content.iconName, content.iconColor)}
      <h3>{content.title}</h3>
    </div>
  );
}
```

**Benefits:**
- No external dependencies to mock
- Tests focus on rendering and accessibility
- Components are truly reusable
- Easy to test edge cases

### 3. Create Production Wrappers

Connect simple components to real dependencies for production:

```typescript
// src/components/features/contributor/contributor-empty-state-wrapper.tsx
import { Trophy, Users, Calendar } from "lucide-react";
import { ContributorEmptyStateSimple } from "./contributor-empty-state-simple";

const iconMap = {
  trophy: Trophy,
  users: Users,
  calendar: Calendar,
};

export function ContributorEmptyState(props: EmptyStateProps) {
  const renderIcon = (name: string, color: string) => {
    const Icon = iconMap[name] || Users;
    return <Icon className={color} />;
  };

  return <ContributorEmptyStateSimple {...props} renderIcon={renderIcon} />;
}
```

## Testing Strategy

### Business Logic Tests

Test pure functions in isolation:

```typescript
// src/lib/__tests__/contributor-empty-state-config.test.ts
describe("getEmptyStateContent", () => {
  it("returns correct content for no_data type", () => {
    const content = getEmptyStateContent("no_data");
    
    expect(content.iconName).toBe("users");
    expect(content.title).toBe("No Contributor Data Available");
    expect(content.severity).toBe("info");
  });
});
```

**What to test:**
- Input/output correctness
- Edge cases
- Default values
- Error handling

### Presentational Component Tests

Test rendering and accessibility without mocking:

```typescript
// src/components/__tests__/ContributorEmptyStateSimple.test.tsx
describe("ContributorEmptyStateSimple", () => {
  it("renders no_data state correctly", () => {
    render(<ContributorEmptyStateSimple type="no_data" />);
    
    expect(screen.getByText("No Contributor Data Available")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has correct accessibility attributes", () => {
    render(<ContributorEmptyStateSimple type="loading_error" />);
    
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });
});
```

**What to test:**
- Content rendering
- Accessibility attributes (roles, aria-labels)
- Conditional rendering
- CSS classes application
- Event handlers (if any)

## Migration Guide

To refactor an existing component with flaky tests:

### Step 1: Identify Business Logic

Look for:
- Switch statements or complex conditionals
- Data transformations
- Calculations
- State derivation

### Step 2: Extract to Pure Functions

Move business logic to a separate file:
```typescript
// Before (in component)
const getContent = () => {
  switch(type) {
    case "error": return { icon: <ErrorIcon />, text: "Error!" };
  }
};

// After (in separate file)
export function getContent(type: string) {
  switch(type) {
    case "error": return { iconName: "error", text: "Error!" };
  }
}
```

### Step 3: Create Simple Component

Remove all external dependencies:
```typescript
// Before
import { ErrorIcon } from "lucide-react";

// After
interface Props {
  renderIcon?: (name: string) => ReactNode;
}
```

### Step 4: Create Production Wrapper

Connect real dependencies:
```typescript
export function ProductionComponent(props) {
  return <SimpleComponent {...props} renderIcon={realIconRenderer} />;
}
```

### Step 5: Update Tests

- Remove all mocks from component tests
- Add unit tests for extracted business logic
- Focus component tests on rendering/accessibility

## Benefits of This Approach

1. **Reliability**: Tests don't interfere with each other
2. **Speed**: No mock setup overhead, pure functions test instantly
3. **Maintainability**: Clear separation of concerns
4. **Debuggability**: Failures are isolated and easy to trace
5. **Reusability**: Business logic can be used anywhere
6. **Type Safety**: TypeScript works better without complex mocks

## Anti-Patterns to Avoid

❌ **Don't mock everything**
```typescript
vi.mock("@/components/ui/card");
vi.mock("lucide-react");
vi.mock("@/lib/utils");
```

❌ **Don't mix business logic with presentation**
```typescript
function Component() {
  // Complex calculations in component
  const result = data.reduce((acc, item) => {
    // 50 lines of business logic
  });
  
  return <div>{result}</div>;
}
```

❌ **Don't test implementation details**
```typescript
// Bad: Testing internal state
expect(component.state.isOpen).toBe(true);

// Good: Testing user-visible behavior
expect(screen.getByRole("dialog")).toBeVisible();
```

## Examples in Codebase

### Successfully Refactored Components

1. **ContributorEmptyState**
   - Business logic: `src/lib/contributor-empty-state-config.ts`
   - Simple component: `src/components/features/contributor/contributor-empty-state-simple.tsx`
   - Production wrapper: `src/components/features/contributor/contributor-empty-state-wrapper.tsx`
   - Tests: 100% passing, no mocks needed

### Components to Refactor

1. **ContributorCard** - Currently failing due to mock issues
2. **ContributorOfTheMonth** - Renders empty in tests
3. **Any component importing from lucide-react directly**

## Vitest Configuration

For best results, use these settings:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Disable isolation to prevent hanging
    isolate: false,
    
    // Auto-cleanup mocks between tests
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Fail fast to identify issues quickly
    bail: 1,
  }
});
```

## Summary

The key insight is that **business logic and presentation should be tested separately**:

- **Business logic**: Test as unit tests in isolation
- **Presentational components**: Test for accessibility and rendering in isolation

This eliminates the need for complex mocking and results in fast, reliable tests that actually catch bugs instead of fighting with test infrastructure.