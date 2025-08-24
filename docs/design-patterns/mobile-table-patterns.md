# Mobile Table Patterns

## Overview

This document outlines the established patterns for implementing responsive tables in the contributor.info application. These patterns ensure consistent user experience across all device sizes while maintaining data accessibility and usability.

## Core Principles

### 1. Progressive Information Disclosure
- **Mobile First**: Show only essential information on small screens
- **Progressive Enhancement**: Reveal additional details as screen size increases
- **Context Preservation**: Maintain user understanding despite reduced information

### 2. Horizontal Scroll Pattern (TanStack Table)
When tables contain more columns than can fit on mobile screens, we use a horizontal scroll pattern with specific constraints.

#### Implementation
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
- **Simple tables (4-6 columns)**: `min-w-[800px]`
- **Medium tables (7-8 columns)**: `min-w-[1000px]`
- **Complex tables (9+ columns)**: `min-w-[1400px]`

The min-width should be calculated based on:
- Number of columns
- Content density
- Minimum readable width for each column

## Responsive Patterns

### 1. Information Hierarchy on Mobile

#### Repository Lists
**Mobile (< 640px)**
- Show: Repository name, avatar, primary metric
- Hide: Description, language badge, secondary metrics

**Desktop (≥ 640px)**
- Show: All information including descriptions and badges

#### Implementation Example
```tsx
// Repository name - always visible
<span className="font-medium truncate">
  {repo.full_name}
</span>

// Language badge - hidden on mobile
{repo.language && (
  <Badge className="hidden sm:inline-flex">
    {repo.language}
  </Badge>
)}

// Description - hidden on mobile
{repo.description && (
  <p className="hidden sm:block truncate">
    {repo.description}
  </p>
)}
```

### 2. Search Input Responsiveness

Mobile search inputs should expand to full width for better usability.

```tsx
// Responsive search container
<div className="flex flex-col sm:flex-row gap-4">
  <div className="flex-1 sm:flex-initial">
    <Input
      placeholder="Search..."
      className="w-full sm:w-[300px]"
    />
  </div>
</div>
```

### 3. Table Headers

Hide verbose headers on mobile when context is clear from the data.

```tsx
// Title that hides on mobile
<CardTitle className="hidden sm:block">
  Repositories
</CardTitle>

// Badge showing count remains visible
<Badge variant="secondary">
  {repositories.length} total
</Badge>
```

## Responsive Breakpoints

We follow Tailwind's default breakpoints:
- `sm`: 640px and up
- `md`: 768px and up  
- `lg`: 1024px and up
- `xl`: 1280px and up

Most table responsiveness is handled at the `sm` breakpoint.

## Column Width Management

### Desktop Column Widths
Use percentage-based widths with minimum constraints:

```tsx
className={cn(
  header.column.id === "name" && "w-[40%] min-w-[250px]",
  header.column.id === "metric" && "w-[15%] min-w-[100px]",
  header.column.id === "actions" && "w-[5%] min-w-[50px]"
)}
```

### Text Truncation
Apply truncation consistently to prevent layout breaks:

```tsx
// Single line truncation
<span className="truncate">
  {longText}
</span>

// With max-width constraint
<p className="truncate max-w-md">
  {description}
</p>
```

## Interaction Patterns

### Row Click Handling
Ensure clickable rows don't interfere with interactive elements:

```tsx
<TableRow
  onClick={(e) => {
    // Don't trigger if clicking interactive elements
    if (!(e.target as HTMLElement).closest('[role="button"]')) {
      onRowClick(row);
    }
  }}
>
  {/* Row content */}
</TableRow>
```

### Action Columns
Prevent event bubbling on action cells:

```tsx
<TableCell
  onClick={(e) => {
    if (cell.column.id === "actions") {
      e.stopPropagation();
    }
  }}
>
  {/* Action buttons */}
</TableCell>
```

## Mobile-Specific Optimizations

### 1. Touch Targets
Ensure all interactive elements meet minimum touch target size (44x44px):

```tsx
<Button size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
  <Icon className="h-4 w-4" />
</Button>
```

### 2. Scroll Indicators
Consider adding visual indicators for scrollable content:

```tsx
// Optional: Add shadow indicators for scroll
<div className="relative">
  <div className="overflow-x-auto scrollbar-thin">
    <Table>{/* content */}</Table>
  </div>
  {/* Optional scroll indicators */}
</div>
```

### 3. Loading States
Maintain layout consistency during loading:

```tsx
// Skeleton maintains same structure
<div className="space-y-4">
  <Skeleton className="h-10 w-full" /> {/* Search */}
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
</div>
```

## Accessibility Considerations

### 1. Screen Reader Support
Hidden elements should not contain critical information:

```tsx
// Bad: Hiding critical info
<span className="hidden sm:block">{criticalInfo}</span>

// Good: Hiding supplementary info
<p className="hidden sm:block">{description}</p>
```

### 2. Focus Management
Ensure keyboard navigation works with horizontal scroll:

```tsx
<div className="overflow-x-auto" tabIndex={0}>
  <Table>{/* content */}</Table>
</div>
```

### 3. ARIA Labels
Add labels for context when visual information is hidden:

```tsx
<Input
  aria-label="Search repositories"
  placeholder="Search..."
/>
```

## Testing Checklist

When implementing mobile tables, verify:

- [ ] Table is scrollable horizontally on mobile
- [ ] Essential information visible without scrolling
- [ ] Touch targets are adequately sized
- [ ] Search inputs expand on mobile
- [ ] No horizontal page scroll (only table scrolls)
- [ ] Loading states maintain layout
- [ ] Keyboard navigation works
- [ ] Screen reader experience is coherent

## Example Implementations

### Simple Data Table
```tsx
export function SimpleTable({ data }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="hidden sm:block">Items</CardTitle>
          <Badge>{data.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input 
            placeholder="Search..." 
            className="w-full sm:w-[300px]"
          />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              {/* Table implementation */}
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Complex Feature Table
```tsx
export function ComplexTable({ data, onAction }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <CardTitle className="hidden sm:block">
              Complex Data
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Input className="w-full sm:w-[200px]" />
            <Button size="sm">Filter</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1400px]">
              {/* Complex table with many columns */}
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Migration Guide

When updating existing tables to follow these patterns:

1. **Audit Information Hierarchy**
   - Identify essential vs. supplementary information
   - Plan what to show/hide on mobile

2. **Add Responsive Wrappers**
   ```tsx
   // Before
   <Table>{/* content */}</Table>
   
   // After
   <div className="overflow-x-auto">
     <Table className="min-w-[800px]">
       {/* content */}
     </Table>
   </div>
   ```

3. **Apply Responsive Utilities**
   - Add `hidden sm:block` to non-essential elements
   - Update search inputs to `w-full sm:w-[300px]`

4. **Test Across Breakpoints**
   - Verify at 375px (iPhone SE)
   - Verify at 390px (iPhone 14)
   - Verify at 640px (breakpoint boundary)
   - Verify at 768px (tablet)

## Related Documentation

- [Component Guidelines](../component-guidelines.md)
- [Accessibility Standards](../accessibility.md)
- [TanStack Table Documentation](https://tanstack.com/table/latest)