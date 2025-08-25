---
globs: "**/*.{ts,tsx,js,jsx}"
description: Follow invisible, Netflix-like UX patterns for data loading
---

# User Experience Standards

This project follows an **invisible, Netflix-like user experience** where data loading and processing happens automatically in the background.

## Core UX Principles

1. **Database-first** - Always query cached data before API calls
2. **Auto-detection** - Automatically detect and fix data quality issues
3. **Subtle notifications** - Keep users informed without interrupting workflow
4. **Progressive enhancement** - Core functionality works immediately, enhanced features load in background
5. **No manual intervention** - Users never need to click "Load Data" or understand technical details

## Implementation Requirements

### Data Loading
- Query database first, then enhance with API data if needed
- Never show "Click to load" buttons for core functionality
- Auto-detect missing or stale data and refresh invisibly
- Use skeleton loaders, not loading spinners

### Error Handling
- Graceful fallbacks - show cached data if API fails
- User-friendly messages - no technical jargon
- Auto-retry with exponential backoff
- Never block UI for non-critical errors

### Notifications
- Subtle toast notifications for background updates
- No modal dialogs unless absolutely critical
- Progress indicators for long-running operations
- Success messages only for user-initiated actions

## Key Implementation Files

Reference these for patterns:
- `src/lib/progressive-capture/smart-notifications.ts` - Auto-detection on page load
- `src/lib/progressive-capture/background-processor.ts` - Invisible background work
- `src/lib/progressive-capture/ui-notifications.ts` - User-friendly notifications

## Documentation to Follow

When implementing data-loading features:
- Follow `/docs/user-experience/feature-template.md` for patterns
- Use `/docs/user-experience/implementation-checklist.md` for validation
- Reference `/docs/user-experience/invisible-data-loading.md` for standards

## Examples

❌ **Bad UX:**
```jsx
// Forces user to understand technical details
<Button onClick={loadData}>
  Click to fetch repository data from GitHub API
</Button>
```

✅ **Good UX:**
```jsx
// Automatically loads and shows best available data
useEffect(() => {
  // Show cached data immediately
  const cached = await loadFromDatabase();
  setData(cached);
  
  // Enhance with fresh data in background
  backgroundRefresh().then(fresh => {
    setData(fresh);
    showSubtleNotification('Data updated');
  });
}, []);
```