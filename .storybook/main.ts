import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-interactions"
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {}
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
        include: [],
      },
    });
  },
};
export default config;