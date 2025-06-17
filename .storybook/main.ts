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
  async viteFinal(config) {
    // Merge custom configuration into the default config
    return mergeConfig(config, {
      // Add dependencies to pre-optimization
      optimizeDeps: {
        include: ['@mdx-js/react'],
      },
      resolve: {
        alias: {
          // Mock Supabase for Storybook to avoid needing real credentials
          '@/lib/supabase': new URL('./mocks/supabase.ts', import.meta.url).pathname,
        },
      },
    });
  },
};
export default config;