# UI/UX Design Patterns

This folder documents UI and UX design patterns used throughout the contributor.info application.

## Contents

### Mobile Responsive Patterns

- **[mobile-table-patterns.md](./mobile-table-patterns.md)** - Comprehensive guide to responsive table implementations including progressive disclosure, horizontal scroll patterns, and mobile optimizations

## Purpose

This directory contains:
- Responsive design patterns
- Mobile-first approaches
- Component layout strategies
- Interaction patterns
- Accessibility guidelines
- Testing checklists

## Core Design Principles

### Progressive Information Disclosure
- **Mobile First**: Show only essential information on small screens
- **Progressive Enhancement**: Reveal additional details as screen size increases
- **Context Preservation**: Maintain user understanding despite reduced information

### Responsive Breakpoints
Following Tailwind's defaults:
- `sm`: 640px and up
- `md`: 768px and up
- `lg`: 1024px and up
- `xl`: 1280px and up

## Pattern Categories

### Table Patterns

#### Horizontal Scroll Pattern
For tables with more columns than fit on mobile screens:
```tsx
<div className="rounded-lg border overflow-hidden">
  <div className="overflow-x-auto">
    <Table className="min-w-[800px]">
      {/* Table content */}
    </Table>
  </div>
</div>
```

#### Min-Width Guidelines
- Simple tables (4-6 columns): `min-w-[800px]`
- Medium tables (7-8 columns): `min-w-[1000px]`
- Complex tables (9+ columns): `min-w-[1400px]`

### Information Hierarchy

#### Repository Lists
**Mobile (< 640px)**:
- Show: Repository name, avatar, primary metric
- Hide: Description, language badge, secondary metrics

**Desktop (≥ 640px)**:
- Show: All information including descriptions and badges

### Responsive Components

#### Search Inputs
```tsx
<Input
  placeholder="Search..."
  className="w-full sm:w-[300px]"
/>
```

#### Table Headers
```tsx
<CardTitle className="hidden sm:block">
  Repositories
</CardTitle>
```

## Accessibility Considerations

### Screen Reader Support
Hidden elements should not contain critical information.

### Focus Management
Ensure keyboard navigation works with horizontal scroll.

### ARIA Labels
Add labels for context when visual information is hidden.

### Touch Targets
Ensure all interactive elements meet minimum touch target size (44x44px).

## Testing Checklist

When implementing responsive patterns:
- [ ] Table is scrollable horizontally on mobile
- [ ] Essential information visible without scrolling
- [ ] Touch targets are adequately sized
- [ ] Search inputs expand on mobile
- [ ] No horizontal page scroll (only table scrolls)
- [ ] Loading states maintain layout
- [ ] Keyboard navigation works
- [ ] Screen reader experience is coherent

## Device Testing

Verify patterns at these breakpoints:
- 375px (iPhone SE)
- 390px (iPhone 14)
- 640px (breakpoint boundary)
- 768px (tablet)
- 1024px (desktop)

## Related Documentation

- [Patterns](../patterns/) - General code patterns
- [User Experience](../user-experience/) - UX guidelines
- [Implementations](../implementations/) - Feature implementations
- [Component Guidelines](../../src/components/) - Component documentation
