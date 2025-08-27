import type { Meta, StoryObj } from '@storybook/react';
import { PWAInstallPrompt } from './pwa-install-prompt';
import { fn } from '@storybook/test';

const meta: Meta<typeof PWAInstallPrompt> = {
  title: 'UI/PWA Install Prompt',
  component: PWAInstallPrompt,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A mobile-first install prompt for PWA installation. Shows when the beforeinstallprompt event is triggered and hides when the app is already installed.',
      },
    },
  },
  argTypes: {
    onInstall: { action: 'installed' },
    onDismiss: { action: 'dismissed' },
  },
  args: {
    onInstall: fn(),
    onDismiss: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PWAInstallPrompt>;

export const Default: Story = {
  render: (args) => (
    <div className="min-h-screen bg-background p-4 relative">
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">PWA Install Prompt</h2>
        <p className="text-muted-foreground mb-8">
          The install prompt appears at the bottom of the screen when the app can be installed.
        </p>
        <PWAInstallPrompt {...args} />
      </div>
    </div>
  ),
};

export const Installing: Story = {
  render: () => (
    <div className="min-h-screen bg-background p-4 relative">
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">Installing State</h2>
        <p className="text-muted-foreground mb-8">
          Shows loading state during installation process.
        </p>
        {/* Simulate installing state */}
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm bg-card border rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary">📱</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-card-foreground">
                Install Contributor Info
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Get quick access to contributor insights right from your home screen.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  disabled
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs"
                >
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Installing...
                </button>

                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: (args) => (
    <div className="min-h-screen bg-background p-4 relative">
      <div className="max-w-sm mx-auto">
        <h2 className="text-lg font-bold mb-4">Mobile View</h2>
        <p className="text-sm text-muted-foreground mb-8">
          The install prompt is optimized for mobile screens.
        </p>
        <PWAInstallPrompt {...args} />
      </div>
    </div>
  ),
};
