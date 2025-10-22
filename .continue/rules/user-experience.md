# User Experience Standards

## Invisible, Netflix-like UX

This project follows an **invisible, Netflix-like user experience** where data loading happens automatically in the background.

### Core Principles

1. **Database-first**: Always query cached data before API calls
2. **Auto-detection**: Automatically detect and fix data quality issues
3. **Subtle notifications**: Keep users informed without interrupting workflow
4. **Progressive enhancement**: Core functionality works immediately, enhanced features load in background
5. **No manual intervention**: Users never click "Load Data" or understand technical details

## Repository Tracking

- **Manual, user-initiated tracking only** (as of Jan 2025)
- Users explicitly choose repositories via "Track This Repository" button
- No automatic discovery or tracking without user action
- Untracked repositories show tracking card, not errors

## Implementation Guidelines

### New Features
- Follow `/docs/user-experience/feature-template.md` for consistent patterns
- Use `/docs/user-experience/implementation-checklist.md` for auto-detection
- Reference `/docs/user-experience/invisible-data-loading.md` for notifications

### Key Files
- `src/lib/progressive-capture/smart-notifications.ts` - Auto-detection on page load
- `src/lib/progressive-capture/background-processor.ts` - Invisible background work
- `src/lib/progressive-capture/ui-notifications.ts` - User-friendly notifications

## Design Consistency

- All components must match existing design language
- Use Storybook to build and validate UI first
- Test visual changes for performance impact
- Maintain consistent notification patterns

## Review Checklist

- [ ] Immediate value with cached data
- [ ] Automatic data quality detection
- [ ] Subtle, helpful notifications (not technical jargon)
- [ ] Graceful error handling and fallbacks
- [ ] No manual "Load Data" buttons
- [ ] Components match design language
- [ ] Storybook stories created/updated
- [ ] Performance impact tested
