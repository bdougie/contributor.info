# Icon System Documentation

## Overview

This project uses an optimized SVG sprite system for icons, replacing traditional icon libraries to achieve significant bundle size reduction. The system provides ~78% smaller bundle size compared to importing individual icon components.

## Architecture

### Components

1. **SVG Sprite** (`/public/icons.svg`)
   - Single optimized file containing all icon symbols
   - Size: ~22KB (compared to ~100KB for lucide-react)
   - Contains 98 commonly used icons
   - Automatically generated and optimized

2. **Icon Component** (`/src/components/ui/icon.tsx`)
   - React wrapper component for sprite usage
   - Provides type-safe icon names via TypeScript
   - Maintains the same API as lucide-react for easy migration
   - Supports all standard SVG props

3. **Sprite Loader** (`/src/components/ui/svg-sprite-loader.tsx`)
   - Inlines the sprite into the DOM for cross-browser compatibility
   - Handles caching and lazy loading
   - Ensures icons work even with strict CSP policies

4. **Type Definitions** (`/src/types/icons.ts`)
   - Auto-generated TypeScript types for available icons
   - Provides autocomplete and type checking

## Usage

### Basic Usage

```tsx
import { Icon } from '@/components/ui/icon';

// Using the base Icon component
<Icon name="menu" className="h-5 w-5" />

// Using named exports (for compatibility)
import { Menu, Search, ChevronDown } from '@/components/ui/icon';

<Menu className="h-5 w-5" />
<Search size={20} />
<ChevronDown />
```

### Available Props

- `name`: IconName (required) - The icon to display
- `size`: number | string - Sets both width and height
- `width`: number | string - Overrides size for width
- `height`: number | string - Overrides size for height
- `className`: string - Additional CSS classes
- All standard SVG props (stroke, fill, etc.)

## Adding New Icons

1. **Update the icon list** (sprite generation script has been removed):
   ```javascript
   const USED_ICONS = [
     'activity', 'alert-circle', // ... existing icons
     'new-icon-name' // Add your new icon here
   ];
   ```

2. **Regenerate the sprite**:
   ```bash
   # Sprite generation script has been removed
   ```

3. **Add the TypeScript export** (auto-generated but you can add manually if needed):
   ```tsx
   // In src/components/ui/icon.tsx
   export const NewIconName = (props: Omit<IconProps, 'name'>) => 
     <Icon name="new-icon-name" {...props} />;
   ```

## Maintenance

### Regenerating the Sprite

Run this command whenever you need to update the icon set:
```bash
# Sprite generation script has been removed
```

This will:
- Extract icons from lucide-static (installed temporarily)
- Optimize each icon with SVGO
- Generate the sprite file at `/public/icons.svg`
- Update TypeScript types in `/src/types/icons.ts`

### Migration from lucide-react

If you need to migrate more components from lucide-react:

1. **Use the migration script**:
   ```bash
   # Migration script has been removed after completion
   ```

2. **Fix any duplicate semicolons** (if needed):
   ```bash
   node scripts/fix-duplicate-semicolons.js
   ```

### Performance Benefits

- **Before**: ~100KB (lucide-react package)
- **After**: ~22KB (SVG sprite)
- **Savings**: ~78KB (78% reduction)
- **Additional benefits**:
  - Single HTTP request for all icons
  - Better caching
  - Reduced JavaScript bundle size
  - Faster initial page load

## Browser Compatibility

The system uses two methods for maximum compatibility:

1. **External reference**: `<use href="/icons.svg#icon-name">`
2. **Inline sprite**: SVGSpriteInliner component for browsers that don't support external SVG references

This ensures icons work in all modern browsers including:
- Chrome/Edge (all versions)
- Firefox (all versions)
- Safari (12+)
- Mobile browsers

## Troubleshooting

### Icons not showing

1. **Check the sprite is loaded**:
   - Open DevTools Network tab
   - Look for `/icons.svg` request
   - Should return 200 status

2. **Verify sprite IDs**:
   - Icon IDs should be `icon-{name}` format
   - Check the generated sprite has correct IDs

3. **Check SVGSpriteInliner**:
   - Must be included in App.tsx
   - Should be rendered before any icons

### TypeScript errors

1. **Regenerate types**:
   ```bash
   # Sprite generation script has been removed
   ```

2. **Restart TypeScript server**:
   - VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

### Adding icons from other sources

If you need icons not available in lucide:

1. Add the SVG file to a temporary directory
2. Modify the sprite generation script to include it
3. Ensure the SVG is optimized (no fills, proper viewBox)
4. Regenerate the sprite

## Migration History

- **Date**: August 2024
- **Issue**: #358 - Icon consolidation for bundle optimization
- **PR**: #368 - Implemented SVG sprite system
- **Files migrated**: 131 components
- **Bundle reduction**: 78%

## Related Files

- Sprite generation script has been removed
- Migration scripts have been removed after completion
- `/src/components/ui/icon.tsx` - Icon component
- `/src/components/ui/svg-sprite-loader.tsx` - Sprite loader
- `/src/types/icons.ts` - TypeScript definitions
- `/public/icons.svg` - Generated sprite file