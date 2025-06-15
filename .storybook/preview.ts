import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { theme } from './theme'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
      // Enhanced controls panel styling
      expanded: true,
      sort: 'requiredFirst',
    },
    // Apply custom theme to docs
    docs: {
      theme: {
        base: 'light',
        brandTitle: theme.brandTitle,
        brandUrl: theme.brandUrl,
        fontBase: theme.fontBase,
        fontCode: theme.fontCode,
        colorPrimary: theme.colorPrimary,
        colorSecondary: theme.colorSecondary,
        appBg: theme.appBg,
        appContentBg: theme.appContentBg,
        textColor: theme.textColor,
        barTextColor: theme.barTextColor,
        barBg: theme.barBg,
        inputBg: theme.inputBg,
        inputBorder: theme.inputBorder,
        inputTextColor: theme.textColor,
      },
    },
    // Custom backgrounds that match our app theme
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: theme.appBg,
        },
        {
          name: 'secondary',
          value: theme.colorSecondary,
        },
        {
          name: 'dark',
          value: theme.textColor,
        },
      ],
    },
    // Apply global styling
    layout: 'centered',
    // Enhanced viewport options
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1200px',
            height: '800px',
          },
        },
        wide: {
          name: 'Wide Screen',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
  },
};

export default preview;