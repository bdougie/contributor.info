// Custom theme configuration for Storybook
// Brand colors and typography extracted from main app

/**
 * Colors extracted from src/index.css CSS variables
 * Light theme values converted from HSL to hex for Storybook compatibility
 */
export const brandColors = {
  // Primary colors
  primary: '#171717',           // HSL: 0 0% 9% - primary text and accent color
  primaryForeground: '#fafafa', // HSL: 0 0% 98% - text on primary background
  
  // Secondary colors  
  secondary: '#f5f5f5',         // HSL: 0 0% 96.1% - secondary background
  secondaryForeground: '#171717', // HSL: 0 0% 9% - text on secondary background
  
  // Background colors
  background: '#ffffff',        // HSL: 0 0% 100% - main background
  foreground: '#0a0a0a',       // HSL: 0 0% 3.9% - main text color
  
  // Muted colors
  muted: '#f5f5f5',            // HSL: 0 0% 96.1% - muted background
  mutedForeground: '#737373',   // HSL: 0 0% 45.1% - muted text
  
  // UI colors
  border: '#e5e5e5',           // HSL: 0 0% 89.8% - borders
  input: '#e5e5e5',            // HSL: 0 0% 89.8% - input borders
  ring: '#0a0a0a',             // HSL: 0 0% 3.9% - focus rings
  
  // Card colors
  card: '#ffffff',             // HSL: 0 0% 100% - card background
  cardForeground: '#0a0a0a',   // HSL: 0 0% 3.9% - card text
  
  // Accent colors
  accent: '#f5f5f5',           // HSL: 0 0% 96.1% - accent background
  accentForeground: '#171717',  // HSL: 0 0% 9% - accent text
  
  // Destructive colors (error states)
  destructive: '#dc2626',       // HSL: 0 84.2% 60.2% - error color
  destructiveForeground: '#fafafa', // HSL: 0 0% 98% - error text
} as const;

/**
 * Typography extracted from tailwind.config.js and app styles
 * Using Inter font family as primary with system fallbacks
 */
export const brandTypography = {
  // Font families from tailwind config and app
  fontBase: '"Inter", "system-ui", "Avenir", "Helvetica", "Arial", sans-serif',
  fontCode: 'ui-monospace, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  
  // Border radius from CSS variables
  borderRadius: {
    default: 8,  // --radius: 0.5rem (8px)
    md: 6,       // calc(var(--radius) - 2px)
    sm: 4,       // calc(var(--radius) - 4px)
  },
} as const;

/**
 * Complete theme configuration for Storybook
 * Combines extracted brand colors and typography
 */
export const theme = {
  base: 'light' as const,
  
  // Brand information
  brandTitle: 'Contributor.info',
  brandUrl: 'https://contributor.info',
  brandTarget: '_self' as const,
  brandImage: './logo.svg', // Custom logo
  
  // Primary brand colors
  colorPrimary: brandColors.primary,
  colorSecondary: brandColors.secondary,
  
  // App layout colors
  appBg: brandColors.background,
  appContentBg: brandColors.card,
  appBorderColor: brandColors.border,
  appBorderRadius: brandTypography.borderRadius.default,
  
  // Typography
  fontBase: brandTypography.fontBase,
  fontCode: brandTypography.fontCode,
  
  // Text colors
  textColor: brandColors.foreground,
  textInverseColor: brandColors.primaryForeground,
  textMutedColor: brandColors.mutedForeground,
  
  // Toolbar styling
  barTextColor: brandColors.mutedForeground,
  barSelectedColor: brandColors.primary,
  barBg: brandColors.secondary,
  
  // Form styling
  inputBg: brandColors.background,
  inputBorder: brandColors.input,
  inputTextColor: brandColors.foreground,
  inputBorderRadius: brandTypography.borderRadius.md,
} as const;
