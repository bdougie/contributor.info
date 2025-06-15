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
      theme: theme,
    },
    // Custom backgrounds that match our app theme
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'secondary',
          value: '#f5f5f5',
        },
        {
          name: 'dark',
          value: '#0a0a0a',
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