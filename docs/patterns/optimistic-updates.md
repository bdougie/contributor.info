# Optimistic Updates Pattern

## Overview

Optimistic updates provide instant UI feedback by updating the UI before the async operation completes. This creates a responsive, Netflix-like experience where users don't wait for network requests.

## When to Use

Use optimistic updates when:
- The operation is highly likely to succeed (>99% success rate)
- Instant feedback significantly improves UX
- You can easily rollback the UI state on failure
- The operation affects cached/filtered data (like lists)

## Implementation Pattern

### Basic Flow

1. **Optimistically update UI** - Trigger state changes immediately
2. **Provide instant feedback** - Close modals, show success states
3. **Perform async operation** - Update database in background
4. **Handle errors gracefully** - Rollback UI state if operation fails

### Code Example

From `ResponsePreviewModal.tsx:110-167`:

```typescript
const handleMarkAsResponded = async () => {
  if (!currentItem || !workspaceId) {
    return;
  }

  setMarkingAsResponded(true);

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error('You must be logged in to mark items as responded.');
      setMarkingAsResponded(false);
      return;
    }

    const tableName = currentItem.type === 'issue' ? 'issues' : 'discussions';
    const actualId = currentItem.id.replace(/^(issue-|discussion-|review-pr-)/, '');

    // 1. OPTIMISTIC UPDATE - Trigger refresh BEFORE database update
    //    This immediately removes the item from the UI
    onItemMarkedAsResponded?.();

    // 2. INSTANT FEEDBACK - Close modal immediately
    onOpenChange(false);

    // 3. ASYNC OPERATION - Update database in background
    const { error } = await supabase
      .from(tableName)
      .update({
        responded_by: user.id,
        responded_at: new Date().toISOString(),
      })
      .eq('id', actualId);

    // 4. ERROR HANDLING - Rollback on failure
    if (error) {
      console.error('Error marking item as responded: %s', error.message);
      toast.error(`Failed to mark as responded: ${error.message}. Please refresh.`);
      // Trigger another refresh to restore the item to the list
      onItemMarkedAsResponded?.();
      return;
    }

    toast.success(`${currentItem.type === 'issue' ? 'Issue' : 'Discussion'} #${currentItem.number} marked as responded.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error marking item as responded: %s', errorMessage);
    toast.error(`Failed to mark as responded: ${errorMessage}. Please refresh.`);
    // Rollback by triggering refresh to restore proper state
    onItemMarkedAsResponded?.();
  } finally {
    setMarkingAsResponded(false);
  }
};
```

## Key Principles

### 1. Update UI Before Async Operation

```typescript
// ✅ CORRECT - Optimistic update first
onItemMarkedAsResponded?.();
onOpenChange(false);
const { error } = await supabase.from(table).update(...);

// ❌ WRONG - Waiting for async operation
const { error } = await supabase.from(table).update(...);
if (!error) {
  onItemMarkedAsResponded?.();
  onOpenChange(false);
}
```

### 2. Always Provide Rollback Logic

```typescript
if (error) {
  // Show error to user
  toast.error(`Failed: ${error.message}`);

  // Rollback UI state by triggering refresh again
  onItemMarkedAsResponded?.();
  return;
}
```

### 3. Handle All Error Paths

```typescript
try {
  // Optimistic updates
  onItemMarkedAsResponded?.();

  // Async operation
  const { error } = await supabase.from(table).update(...);

  if (error) {
    // Rollback on known error
    onItemMarkedAsResponded?.();
  }
} catch (error) {
  // Rollback on unexpected error
  onItemMarkedAsResponded?.();
}
```

## Common Pitfalls

### ❌ Using setTimeout for "Delayed" Updates

```typescript
// DON'T DO THIS - Race conditions and unreliable timing
const { error } = await supabase.from(table).update(...);
setTimeout(() => {
  onItemMarkedAsResponded?.();
}, 100); // Arbitrary delay, doesn't guarantee data is ready
```

**Problem**: Creates race conditions where UI updates before or after cache invalidation unpredictably.

### ❌ Forgetting Rollback Logic

```typescript
// DON'T DO THIS - Leaves UI in inconsistent state on error
onItemMarkedAsResponded?.();
const { error } = await supabase.from(table).update(...);
// No rollback if error occurs!
```

**Problem**: UI shows item as removed, but database still has it. User confusion on next page load.

### ❌ Only Rolling Back on One Error Path

```typescript
// DON'T DO THIS - Missing catch block rollback
try {
  onItemMarkedAsResponded?.();
  const { error } = await supabase.from(table).update(...);

  if (error) {
    onItemMarkedAsResponded?.(); // Rollback here
  }
} catch (error) {
  // Missing rollback here!
  toast.error('Failed');
}
```

**Problem**: Network errors, timeout errors, or unexpected exceptions leave UI in inconsistent state.

## Benefits

1. **Instant Feedback** - Users see immediate response to actions
2. **Better Perceived Performance** - App feels faster even with slow networks
3. **Reduced User Friction** - No waiting for spinners or loading states
4. **Professional UX** - Matches expectations from modern apps (Twitter, Gmail, etc.)

## Trade-offs

1. **Added Complexity** - Must handle rollback logic carefully
2. **Potential Confusion** - If operation fails, user briefly sees incorrect state
3. **Not Suitable for Critical Operations** - Don't use for irreversible actions (delete, payment, etc.)

## Related Patterns

- **TanStack Query Mutations**: The inspiration for this pattern ([docs](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates))
- **Cache Invalidation**: Optimistic updates work best with proper cache invalidation
- **Error Boundaries**: Should be wrapped in error boundaries for unexpected failures

## References

- TanStack Query Optimistic Updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- Implementation: `src/components/features/workspace/ResponsePreviewModal.tsx:110-167`
- Usage: "My Work" respond tracking feature (Jan 2025)
