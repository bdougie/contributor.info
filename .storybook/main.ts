import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    {
      name: '@storybook/addon-essentials',
      options: {
        docs: {
          mdxPluginOptions: {
            mdxCompileOptions: {
              remarkPlugins: [],
            },
          },
          // Enhanced documentation generation
          autodocs: 'tag',
          defaultName: 'Documentation',
        },
        // Enhanced controls for better prop detection
        controls: {
          matchers: {
            color: /(background|color)$/i,
            date: /Date$/i,
          },
        },
        // Enhanced actions for better interaction testing
        actions: {
          argTypesRegex: '^on[A-Z].*',
        },
      },
    },
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  features: {
    // Enable TurboSnap for Chromatic
    buildStoriesJson: true,
  },
  // Custom manager head configuration
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <title>Contributor.info - Storybook</title>
    <meta name="description" content="Component library and design system for Contributor.info" />
  `,
  // Enhanced TypeScript configuration for better prop detection
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => {
        // Include props from external libraries
        if (prop.declarations !== undefined && prop.declarations.length > 0) {
          const hasPropAdditionalDescription = prop.declarations.find((declaration) => {
            return !declaration.fileName.includes('node_modules');
          });
          return Boolean(hasPropAdditionalDescription);
        }
        return true;
      },
    },
  },
  async viteFinal(config) {
    // Merge custom configuration into the default config
    return mergeConfig(config, {
      // Re-enable tree shaking after nested ternary refactoring (PRs #574, #592, #594, #595)
      // Tree shaking now safe to use with utility function patterns
      build: {
        rollupOptions: {
          // Exclude server-only packages from the browser bundle
          external: ['inngest'],
          treeshake: {
            moduleSideEffects: true,
            propertyReadSideEffects: true,
            tryCatchDeoptimization: false,
            unknownGlobalSideEffects: true,
            correctVarValueBeforeDeclaration: false,
          },
        },
      },
      optimizeDeps: {
        exclude: ['inngest'],
      },
      resolve: {
        alias: {
          // Mock Supabase for Storybook to avoid needing real credentials
          '@/lib/supabase': new URL('./mocks/supabase.ts', import.meta.url).pathname,
          // Mock react-router-dom for Storybook to avoid router-related errors
          'react-router-dom': new URL('./mocks/react-router-dom.ts', import.meta.url).pathname,
          // Mock hooks for Storybook to avoid dependency issues
          '@/hooks/use-on-demand-sync': new URL('./mocks/use-on-demand-sync.ts', import.meta.url)
            .pathname,
          '@/hooks/use-github-auth': new URL('./mocks/use-github-auth.ts', import.meta.url)
            .pathname,
          '@/hooks/use-auth': new URL('./mocks/use-auth.ts', import.meta.url).pathname,
          '@/hooks/use-user-workspaces': new URL('./mocks/use-user-workspaces.ts', import.meta.url)
            .pathname,
          '@/hooks/use-cached-repo-data': new URL(
            './mocks/use-cached-repo-data.ts',
            import.meta.url
          ).pathname,
          '@/hooks/use-repo-search': new URL('./mocks/use-repo-search.ts', import.meta.url)
            .pathname,
          '@/hooks/use-repo-stats': new URL('./mocks/use-repo-stats.ts', import.meta.url).pathname,
          '@/hooks/use-time-formatter': new URL('./mocks/use-time-formatter.ts', import.meta.url)
            .pathname,
          '@/hooks/use-auto-track-repository': new URL(
            './mocks/use-auto-track-repository.ts',
            import.meta.url
          ).pathname,
          // Mock stores and utilities
          '@/lib/time-range-store': new URL('./mocks/time-range-store.ts', import.meta.url)
            .pathname,
          '@/lib/insights/health-metrics': new URL('./mocks/health-metrics.ts', import.meta.url)
            .pathname,
          '@/lib/contribution-analyzer': new URL(
            './mocks/contribution-analyzer.ts',
            import.meta.url
          ).pathname,
          '@/lib/dub': new URL('./mocks/dub.ts', import.meta.url).pathname,
          '@/lib/progressive-capture/manual-trigger': new URL(
            './mocks/manual-trigger.ts',
            import.meta.url
          ).pathname,
          '@/lib/progressive-capture/smart-notifications': new URL(
            './mocks/smart-notifications.ts',
            import.meta.url
          ).pathname,
          '@/lib/progressive-capture/background-processor': new URL(
            './mocks/background-processor.ts',
            import.meta.url
          ).pathname,
          // Mock components
          '@/components/common/cards': new URL('./mocks/cards.ts', import.meta.url).pathname,
          '@/components/features/sharing/shareable-card': new URL(
            './mocks/shareable-card.ts',
            import.meta.url
          ).pathname,
          '@/components/features/contributor': new URL('./mocks/contributor.ts', import.meta.url)
            .pathname,
          '@/components/icons/LotteryIcon': new URL('./mocks/icons.ts', import.meta.url).pathname,
          '@/components/icons/YoloIcon': new URL('./mocks/icons.ts', import.meta.url).pathname,
          // Mock health components
          '@/components/insights/sections/repository-health-overall': new URL(
            './mocks/health-components.ts',
            import.meta.url
          ).pathname,
          '@/components/insights/sections/repository-health-factors': new URL(
            './mocks/health-components.ts',
            import.meta.url
          ).pathname,
          './lottery-factor': new URL('./mocks/health-components.ts', import.meta.url).pathname,
          './contributor-confidence-card': new URL('./mocks/health-components.ts', import.meta.url)
            .pathname,
          '@/components/features/contributor/self-selection-rate': new URL(
            './mocks/health-components.ts',
            import.meta.url
          ).pathname,
        },
      },
      // Enhanced server configuration for development
      server: {
        fs: {
          strict: false,
        },
      },
    });
  },
};
export default config;
