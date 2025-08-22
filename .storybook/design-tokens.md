# Design Tokens Documentation

## Overview

The design tokens system provides a single source of truth for all visual design decisions in the Contributor.info application. These tokens ensure consistency across components and make it easy to maintain and update the design system.

## Usage in Components

### Importing Tokens

```typescript
import { designTokens } from '.storybook/design-tokens';

// Or import specific token groups
import { colors, spacing, typography } from '.storybook/design-tokens';
```

### Using in Storybook Stories

```typescript
import { designTokens } from '../design-tokens';

export const ColorPalette: Story = {
  render: () => (
    <div style={{ 
      padding: designTokens.spacing[4],
      backgroundColor: designTokens.colors.background.DEFAULT 
    }}>
      {/* Component content */}
    </div>
  ),
};
```

## Token Categories

### 1. Colors

The color system includes:
- **Primary colors**: Blue scale for main actions and emphasis
- **Secondary colors**: Purple scale for accents
- **Neutral colors**: Gray scale for text and backgrounds
- **Semantic colors**: Success, warning, error, info states
- **GitHub colors**: Platform-specific brand colors
- **Component colors**: Background, border, and text variations

#### Color Usage Guidelines

- **Primary actions**: Use `colors.primary.500` for buttons and links
- **Hover states**: Use darker shades (600-700)
- **Disabled states**: Use `colors.neutral.400`
- **Backgrounds**: Use `colors.background.*` variants
- **Text**: Use `colors.text.*` for different text hierarchies

### 2. Spacing

Based on a 4px grid system:
- `spacing[1]` = 4px
- `spacing[2]` = 8px
- `spacing[4]` = 16px
- `spacing[8]` = 32px

#### Spacing Usage

- **Component padding**: Use `spacing[3]` to `spacing[4]`
- **Layout margins**: Use `spacing[4]` to `spacing[8]`
- **Inline spacing**: Use `spacing[1]` to `spacing[2]`
- **Section spacing**: Use `spacing[8]` and above

### 3. Typography

Includes font families, sizes, weights, and line heights:

#### Font Families
- **Sans-serif**: System fonts for body text
- **Monospace**: Code and technical content

#### Font Sizes
- `xs` (12px) - Small labels and captions
- `sm` (14px) - Secondary text
- `base` (16px) - Body text
- `lg` (18px) - Emphasized text
- `xl` to `4xl` - Headings

#### Font Weights
- `normal` (400) - Body text
- `medium` (500) - Slight emphasis
- `semibold` (600) - Subheadings
- `bold` (700) - Headings

### 4. Breakpoints

Responsive design breakpoints:
- `xs`: 320px - Mobile portrait
- `sm`: 640px - Mobile landscape
- `md`: 768px - Tablet
- `lg`: 1024px - Desktop
- `xl`: 1280px - Wide desktop
- `2xl`: 1536px - Ultra-wide

### 5. Border Radius

Consistent corner rounding:
- `sm`: 2px - Subtle rounding
- `DEFAULT`: 4px - Standard components
- `md`: 6px - Cards and containers
- `lg`: 8px - Modals and dialogs
- `full`: 9999px - Pills and badges

### 6. Shadows

Elevation system:
- `xs`: Subtle elevation
- `sm`: Interactive elements
- `DEFAULT`: Cards and dropdowns
- `md` to `xl`: Modals and overlays

### 7. Z-Index

Layering scale:
- Base content: 0-50
- `dropdown`: 1000
- `sticky`: 1020
- `modal`: 1050
- `popover`: 1060
- `tooltip`: 1070
- `notification`: 1080

### 8. Animation

Motion design tokens:

#### Durations
- `instant`: 0ms - No animation
- `fast`: 150ms - Micro-interactions
- `normal`: 300ms - Standard transitions
- `slow`: 500ms - Complex animations

#### Easing
- `linear`: Constant speed
- `easeOut`: Natural deceleration
- `easeInOut`: Smooth start and end
- `bounce`: Playful emphasis

## Component Integration

### Example: Button Component

```typescript
const buttonStyles = {
  padding: `${spacing[2]} ${spacing[4]}`,
  fontSize: typography.fontSize.base.size,
  fontWeight: typography.fontWeight.medium,
  borderRadius: borderRadius.md,
  transition: animation.transition.all,
  backgroundColor: colors.primary[500],
  color: colors.text.inverse,
  
  '&:hover': {
    backgroundColor: colors.primary[600],
    boxShadow: shadows.sm,
  },
  
  '&:disabled': {
    backgroundColor: colors.neutral[400],
    cursor: 'not-allowed',
  },
};
```

### Example: Card Component

```typescript
const cardStyles = {
  padding: spacing[4],
  backgroundColor: colors.background.DEFAULT,
  border: `1px solid ${colors.border.DEFAULT}`,
  borderRadius: borderRadius.lg,
  boxShadow: shadows.sm,
  
  '@media (min-width: ${breakpoints.md})': {
    padding: spacing[6],
  },
};
```

## Tailwind CSS Integration

These tokens can be integrated with Tailwind CSS configuration:

```javascript
// tailwind.config.js
import { designTokens } from './.storybook/design-tokens';

export default {
  theme: {
    extend: {
      colors: designTokens.colors,
      spacing: designTokens.spacing,
      fontFamily: designTokens.typography.fontFamily,
      // ... other tokens
    },
  },
};
```

## Dark Mode Support

The design tokens are structured to support dark mode:

```typescript
const darkModeColors = {
  background: {
    DEFAULT: colors.neutral[900],
    secondary: colors.neutral[800],
  },
  text: {
    primary: colors.neutral[50],
    secondary: colors.neutral[200],
  },
  // ... other dark mode overrides
};
```

## Maintenance Guidelines

1. **Never hardcode values** - Always use tokens
2. **Document changes** - Update this file when adding tokens
3. **Maintain consistency** - Follow existing patterns
4. **Test thoroughly** - Verify tokens work across components
5. **Consider accessibility** - Ensure sufficient contrast ratios

## Migration from Hardcoded Values

To migrate existing components:

1. Identify hardcoded values
2. Find corresponding token
3. Replace with token reference
4. Test component appearance
5. Update component stories

Example migration:
```typescript
// Before
style={{ padding: '16px', color: '#24292f' }}

// After
style={{ padding: spacing[4], color: colors.text.primary }}
```

## Contributing

When adding new tokens:

1. Add to appropriate section in `design-tokens.ts`
2. Update this documentation
3. Create example usage in Storybook
4. Update affected components
5. Test across different viewports

## Resources

- [Storybook Design System](https://storybook.js.org/docs/react/workflows/design-systems)
- [Design Tokens W3C Draft](https://design-tokens.github.io/community-group/format/)
- [Material Design Guidelines](https://material.io/design)
- [GitHub Primer Design System](https://primer.style)