import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import * as React from 'react';
import { useState } from 'react';
import { designTokens } from '../../../.storybook/design-tokens';
import { Switch } from './switch';
import { Label } from './label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';

const meta = {
  title: 'UI/Forms/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A toggle switch component for binary choices. Built on Radix UI with full accessibility support, keyboard navigation, and customizable styling.',
      },
    },
  },
  tags: ['autodocs', 'interaction', 'accessibility'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'The controlled checked state of the switch',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    defaultChecked: {
      control: 'boolean',
      description: 'The default checked state (uncontrolled)',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the switch is disabled',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Whether the switch is required',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    name: {
      control: 'text',
      description: 'The name of the switch for form submission',
    },
    value: {
      control: 'text',
      description: 'The value of the switch for form submission',
      table: {
        defaultValue: { summary: 'on' },
      },
    },
    onCheckedChange: {
      action: 'checked changed',
      description: 'Callback when the checked state changes',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ 
        minWidth: '300px',
        padding: designTokens.spacing[4],
      }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

export const LabelPositions: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div className="flex items-center space-x-2">
        <Switch id="label-right" />
        <Label htmlFor="label-right">Label on Right</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Label htmlFor="label-left">Label on Left</Label>
        <Switch id="label-left" />
      </div>
      
      <div className="flex flex-col gap-1">
        <Label htmlFor="label-top">Label on Top</Label>
        <Switch id="label-top" />
      </div>
      
      <div className="flex flex-col gap-1">
        <Switch id="label-bottom" />
        <Label htmlFor="label-bottom">Label on Bottom</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different label positioning options for various layouts.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[4] }}>
      <div className="flex items-center space-x-2">
        <Switch id="small" className="scale-75" />
        <Label htmlFor="small">Small (75% scale)</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch id="default" />
        <Label htmlFor="default">Default Size</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch id="large" className="scale-125" />
        <Label htmlFor="large">Large (125% scale)</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Switch components in different sizes using CSS transforms.',
      },
    },
  },
};

export const States: Story = {
  render: () => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(2, 1fr)', 
      gap: designTokens.spacing[4] 
    }}>
      <div>
        <Label className="text-sm font-medium mb-2 block">Unchecked</Label>
        <Switch />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-2 block">Checked</Label>
        <Switch defaultChecked />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-2 block">Disabled Off</Label>
        <Switch disabled />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-2 block">Disabled On</Label>
        <Switch disabled defaultChecked />
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-2 block">Loading</Label>
        <div className="flex items-center space-x-2">
          <Switch disabled />
          <span className="text-sm text-muted-foreground">Processing...</span>
        </div>
      </div>
      
      <div>
        <Label className="text-sm font-medium mb-2 block">Error State</Label>
        <div>
          <Switch className="data-[state=checked]:bg-red-500" />
          <p className="text-xs text-red-600 mt-1">Connection failed</p>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Various states of the switch component.',
      },
    },
  },
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-center justify-between space-x-4">
      <div className="space-y-0.5">
        <Label htmlFor="marketing-emails" className="text-base">
          Marketing emails
        </Label>
        <p className="text-sm text-muted-foreground">
          Receive emails about new products, features, and more.
        </p>
      </div>
      <Switch id="marketing-emails" />
    </div>
  ),
};

export const ColoredSwitches: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designTokens.spacing[3] }}>
      <div className="flex items-center space-x-2">
        <Switch id="default-color" defaultChecked />
        <Label htmlFor="default-color">Default (Primary)</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="success" 
          defaultChecked 
          className="data-[state=checked]:bg-green-500"
        />
        <Label htmlFor="success">Success State</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="warning" 
          defaultChecked 
          className="data-[state=checked]:bg-amber-500"
        />
        <Label htmlFor="warning">Warning State</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="danger" 
          defaultChecked 
          className="data-[state=checked]:bg-red-500"
        />
        <Label htmlFor="danger">Danger State</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="info" 
          defaultChecked 
          className="data-[state=checked]:bg-blue-500"
        />
        <Label htmlFor="info">Info State</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Switches with different colors for various semantic states.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const InteractiveExample = () => {
      const [isEnabled, setIsEnabled] = useState(false);
      const [log, setLog] = useState<string[]>([]);

      const handleChange = (checked: boolean) => {
        setIsEnabled(checked);
        setLog(prev => [...prev, `Switch ${checked ? 'enabled' : 'disabled'} at ${new Date().toLocaleTimeString()}`]);
      };

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="interactive" className="text-base font-medium">
                Feature Toggle
              </Label>
              <p className="text-sm text-muted-foreground">
                {isEnabled ? '✅ Feature is active' : '❌ Feature is inactive'}
              </p>
            </div>
            <Switch 
              id="interactive" 
              checked={isEnabled}
              onCheckedChange={handleChange}
            />
          </div>
          
          {isEnabled && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <p className="text-green-800">
                  Feature is now enabled! Additional options would appear here.
                </p>
              </CardContent>
            </Card>
          )}
          
          {log.length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-medium">Activity Log:</p>
              {log.slice(-3).map((entry, i) => (
                <p key={i} className="text-muted-foreground">{entry}</p>
              ))}
            </div>
          )}
        </div>
      );
    };
    return <InteractiveExample />;
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchElement = canvas.getByRole('switch');
    
    // Check initial state
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute('aria-checked', 'false');
    
    // Click to enable
    userEvent.click(switchElement);
    
    setTimeout(() => {
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
      expect(canvas.getByText(/Feature is active/)).toBeInTheDocument();
      
      // Click to disable
      userEvent.click(switchElement);
      
      setTimeout(() => {
        expect(switchElement).toHaveAttribute('aria-checked', 'false');
        expect(canvas.getByText(/Feature is inactive/)).toBeInTheDocument();
      }, 100);
    }, 100);
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive switch with state changes and visual feedback.',
      },
    },
  },
};

export const SettingsPanel: Story = {
  render: () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Manage how you receive notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="push" className="flex flex-col space-y-1">
              <span>Push Notifications</span>
              <span className="font-normal text-muted-foreground text-sm">
                Receive push notifications on your device
              </span>
            </Label>
            <Switch id="push" defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="email" className="flex flex-col space-y-1">
              <span>Email Alerts</span>
              <span className="font-normal text-muted-foreground text-sm">
                Get important updates via email
              </span>
            </Label>
            <Switch id="email" defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="sms" className="flex flex-col space-y-1">
              <span>SMS Messages</span>
              <span className="font-normal text-muted-foreground text-sm">
                Receive text messages for urgent alerts
              </span>
            </Label>
            <Switch id="sms" />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly" className="flex flex-col space-y-1">
              <span>Weekly Digest</span>
              <span className="font-normal text-muted-foreground text-sm">
                Summary of your weekly activity
              </span>
            </Label>
            <Switch id="weekly" defaultChecked />
          </div>
        </div>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete settings panel with multiple switch controls.',
      },
    },
  },
};

export const AccessibilityFeatures: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Accessibility Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="high-contrast" className="flex flex-col space-y-1">
            <span>High Contrast Mode</span>
            <span className="font-normal text-muted-foreground text-sm">
              Increase contrast for better visibility
            </span>
          </Label>
          <Switch 
            id="high-contrast" 
            aria-label="Toggle high contrast mode"
            aria-describedby="high-contrast-desc"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="large-text" className="flex flex-col space-y-1">
            <span>Large Text</span>
            <span className="font-normal text-muted-foreground text-sm">
              Increase text size throughout the app
            </span>
          </Label>
          <Switch 
            id="large-text"
            aria-label="Toggle large text"
            aria-describedby="large-text-desc"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="reduce-motion" className="flex flex-col space-y-1">
            <span>Reduce Motion</span>
            <span className="font-normal text-muted-foreground text-sm">
              Minimize animations and transitions
            </span>
          </Label>
          <Switch 
            id="reduce-motion"
            aria-label="Toggle reduced motion"
            aria-describedby="reduce-motion-desc"
            defaultChecked
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="screen-reader" className="flex flex-col space-y-1">
            <span>Screen Reader Optimization</span>
            <span className="font-normal text-muted-foreground text-sm">
              Optimize for screen reader software
            </span>
          </Label>
          <Switch 
            id="screen-reader"
            aria-label="Toggle screen reader optimization"
            aria-describedby="screen-reader-desc"
          />
        </div>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Accessibility-focused settings with proper ARIA labels and descriptions.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  render: () => (
    <form className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch id="first" />
        <Label htmlFor="first">First Switch (Tab to focus)</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch id="second" />
        <Label htmlFor="second">Second Switch (Tab to navigate)</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch id="third" />
        <Label htmlFor="third">Third Switch (Space to toggle)</Label>
      </div>
      
      <Button type="submit">Submit</Button>
    </form>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switches = canvas.getAllByRole('switch');
    
    // Focus first switch
    switches[0].focus();
    expect(document.activeElement).toBe(switches[0]);
    
    // Simulate Space key to toggle
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    switches[0].dispatchEvent(spaceEvent);
    
    // Tab to next switch
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(tabEvent);
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates keyboard navigation and toggling with Space key.',
      },
    },
  },
  tags: ['interaction', 'accessibility'],
};

export const MobileOptimized: Story = {
  render: () => (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="mobile-wifi" className="text-base">
                Wi-Fi
              </Label>
              <Switch 
                id="mobile-wifi" 
                defaultChecked
                className="touch-manipulation scale-110"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="mobile-bluetooth" className="text-base">
                Bluetooth
              </Label>
              <Switch 
                id="mobile-bluetooth"
                className="touch-manipulation scale-110"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="mobile-location" className="text-base">
                Location Services
              </Label>
              <Switch 
                id="mobile-location" 
                defaultChecked
                className="touch-manipulation scale-110"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="mobile-data" className="text-base">
                Mobile Data
              </Label>
              <Switch 
                id="mobile-data"
                className="touch-manipulation scale-110"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-sm text-muted-foreground text-center">
        Optimized for touch with larger tap targets
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Mobile-optimized switches with larger touch targets.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🌙</span>
          <Label htmlFor="dark-mode">Dark Mode</Label>
        </div>
        <Switch id="dark-mode" />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🔔</span>
          <Label htmlFor="notifications">Notifications</Label>
        </div>
        <Switch id="notifications" defaultChecked />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🔒</span>
          <Label htmlFor="privacy">Private Profile</Label>
        </div>
        <Switch id="privacy" />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✈️</span>
          <Label htmlFor="airplane">Airplane Mode</Label>
        </div>
        <Switch id="airplane" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Switches with icons for better visual context.',
      },
    },
  },
};

export const Controlled: Story = {
  render: () => {
    const ControlledExample = () => {
      const [checked, setChecked] = useState(false);
      
      return (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="controlled">
                  Status: {checked ? 'Active' : 'Inactive'}
                </Label>
                <Switch 
                  id="controlled" 
                  checked={checked} 
                  onCheckedChange={setChecked}
                />
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setChecked(true)}
            >
              Turn On
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setChecked(false)}
            >
              Turn Off
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setChecked(!checked)}
            >
              Toggle
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            The switch is currently <strong>{checked ? 'ON' : 'OFF'}</strong>
          </p>
        </div>
      );
    };
    return <ControlledExample />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Controlled switch with external state management.',
      },
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: designTokens.spacing[4],
    }}>
      <div className="text-center">
        <Label className="text-xs mb-2 block">Default Off</Label>
        <Switch />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Default On</Label>
        <Switch defaultChecked />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Disabled Off</Label>
        <Switch disabled />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Disabled On</Label>
        <Switch disabled defaultChecked />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Small</Label>
        <Switch className="scale-75" />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Large</Label>
        <Switch className="scale-125" />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Success</Label>
        <Switch defaultChecked className="data-[state=checked]:bg-green-500" />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Warning</Label>
        <Switch defaultChecked className="data-[state=checked]:bg-amber-500" />
      </div>
      
      <div className="text-center">
        <Label className="text-xs mb-2 block">Danger</Label>
        <Switch defaultChecked className="data-[state=checked]:bg-red-500" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All switch variants and states in one view.',
      },
    },
  },
};