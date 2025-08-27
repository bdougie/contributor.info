import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Navigation/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A set of layered sections of content—known as tab panels—that are displayed one at a time.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="space-y-2">
        <h3 className="text-lg font-medium">Account</h3>
        <p className="text-sm text-muted-foreground">
          Make changes to your account here. Click save when you're done.
        </p>
      </TabsContent>
      <TabsContent value="password" className="space-y-2">
        <h3 className="text-lg font-medium">Password</h3>
        <p className="text-sm text-muted-foreground">
          Change your password here. After saving, you'll be logged out.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const WithCards: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Make changes to your account here. Click save when you're done.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Pedro Duarte" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="@peduarte" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Save changes</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password here. After saving, you'll be logged out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Save password</Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Overview</h3>
          <div className="grid gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold">2,847</p>
                </div>
                <div className="text-green-600">+12%</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Revenue</p>
                  <p className="text-2xl font-bold">$45,231</p>
                </div>
                <div className="text-green-600">+8%</div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="analytics" className="mt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Detailed analytics and insights about your application performance.
          </p>
          <div className="h-32 rounded-lg border border-dashed flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Analytics Chart Placeholder</p>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="reports" className="mt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Reports</h3>
          <p className="text-sm text-muted-foreground">Generate and download various reports.</p>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Download Monthly Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Download Annual Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Download Custom Report
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="general" className="w-full" orientation="vertical">
      <div className="flex">
        <TabsList className="flex flex-col h-auto w-32">
          <TabsTrigger value="general" className="w-full">
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="w-full">
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="w-full">
            Notifications
          </TabsTrigger>
        </TabsList>
        <div className="flex-1 ml-6">
          <TabsContent value="general">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">General Settings</h3>
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input id="site-name" defaultValue="My Website" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description">Description</Label>
                <Input id="site-description" defaultValue="A great website" />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="security">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Security Settings</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Two-factor authentication</Label>
                  <Button variant="outline" size="sm">
                    Enable
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Login notifications</Label>
                  <Button variant="outline" size="sm">
                    On
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="notifications">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notification Preferences</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email notifications</Label>
                  <Button variant="outline" size="sm">
                    On
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Push notifications</Label>
                  <Button variant="outline" size="sm">
                    Off
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tab1">Available</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="tab3">Also Available</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p>This tab is available and active.</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p>This tab is disabled and cannot be selected.</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p>This tab is also available for selection.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="tab1">Home</TabsTrigger>
        <TabsTrigger value="tab2">Products</TabsTrigger>
        <TabsTrigger value="tab3">Services</TabsTrigger>
        <TabsTrigger value="tab4">About</TabsTrigger>
        <TabsTrigger value="tab5">Contact</TabsTrigger>
        <TabsTrigger value="tab6">Blog</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <p>Welcome to our homepage!</p>
      </TabsContent>
      <TabsContent value="tab2">
        <p>Browse our products catalog.</p>
      </TabsContent>
      <TabsContent value="tab3">
        <p>Learn about our services.</p>
      </TabsContent>
      <TabsContent value="tab4">
        <p>About our company.</p>
      </TabsContent>
      <TabsContent value="tab5">
        <p>Get in touch with us.</p>
      </TabsContent>
      <TabsContent value="tab6">
        <p>Read our latest blog posts.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const TabsInteraction: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="space-y-2">
        <h3 className="text-lg font-medium">Tab 1 Content</h3>
        <p>This is the content for tab 1.</p>
      </TabsContent>
      <TabsContent value="tab2" className="space-y-2">
        <h3 className="text-lg font-medium">Tab 2 Content</h3>
        <p>This is the content for tab 2.</p>
      </TabsContent>
      <TabsContent value="tab3" className="space-y-2">
        <h3 className="text-lg font-medium">Tab 3 Content</h3>
        <p>This is the content for tab 3.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const TabsKeyboardNavigation: Story = {
  render: () => (
    <Tabs defaultValue="keyboard1" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="keyboard1">First</TabsTrigger>
        <TabsTrigger value="keyboard2">Second</TabsTrigger>
        <TabsTrigger value="keyboard3">Third</TabsTrigger>
      </TabsList>
      <TabsContent value="keyboard1">
        <div>First tab content</div>
      </TabsContent>
      <TabsContent value="keyboard2">
        <div>Second tab content</div>
      </TabsContent>
      <TabsContent value="keyboard3">
        <div>Third tab content</div>
      </TabsContent>
    </Tabs>
  ),
  tags: ['interaction', 'accessibility'],
};
