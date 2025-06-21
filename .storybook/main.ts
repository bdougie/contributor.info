import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    {
      name: "@storybook/addon-essentials",
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
    "@storybook/addon-onboarding",
    "@storybook/addon-interactions"
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
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
      resolve: {
        alias: {
          // Mock Supabase for Storybook to avoid needing real credentials
          '@/lib/supabase': new URL('./mocks/supabase.ts', import.meta.url).pathname,
          // Mock react-router-dom for Storybook to avoid router-related errors
          'react-router-dom': new URL('./mocks/react-router-dom.ts', import.meta.url).pathname,
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