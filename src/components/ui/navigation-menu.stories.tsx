import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from './navigation-menu';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

const meta = {
  title: 'UI/Navigation/NavigationMenu',
  component: NavigationMenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A collection of links for navigating websites built on Radix UI Navigation Menu.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data for stories
const gettingStartedItems = [
  {
    title: 'Installation',
    href: '/docs/installation',
    description: 'How to install dependencies and structure your app.',
  },
  {
    title: 'Project Structure',
    href: '/docs/project-structure',
    description: 'How to organize your project files and folders.',
  },
  {
    title: 'Styling',
    href: '/docs/styling',
    description: 'How to style your components with Tailwind CSS.',
  },
];

const componentsItems = [
  {
    title: 'Alert Dialog',
    href: '/docs/components/alert-dialog',
    description: 'A modal dialog that interrupts the user with important content.',
  },
  {
    title: 'Button',
    href: '/docs/components/button',
    description: 'Displays a button or a component that looks like a button.',
  },
  {
    title: 'Card',
    href: '/docs/components/card',
    description: 'Displays a card with header, content, and footer.',
  },
  {
    title: 'Dialog',
    href: '/docs/components/dialog',
    description: 'A window overlaid on either the primary window.',
  },
  {
    title: 'Navigation Menu',
    href: '/docs/components/navigation-menu',
    description: 'A collection of links for navigating websites.',
  },
  {
    title: 'Tooltip',
    href: '/docs/components/tooltip',
    description: 'A popup that displays information related to an element.',
  },
];

const examples = [
  {
    name: 'Dashboard',
    href: '/examples/dashboard',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/dashboard',
  },
  {
    name: 'Cards',
    href: '/examples/cards',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/cards',
  },
  {
    name: 'Tasks',
    href: '/examples/tasks',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/tasks',
  },
  {
    name: 'Playground',
    href: '/examples/playground',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/playground',
  },
  {
    name: 'Forms',
    href: '/examples/forms',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/forms',
  },
  {
    name: 'Music',
    href: '/examples/music',
    code: 'https://github.com/shadcn/ui/tree/main/apps/www/app/examples/music',
  },
];

const ListItem = ({
  className,
  title,
  children,
  ...props
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<'a'>) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
};

export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <li className="row-span-3">
                <NavigationMenuLink asChild>
                  <a
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                    href="/"
                  >
                    <div className="mb-2 mt-4 text-lg font-medium">
                      shadcn/ui
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground">
                      Beautifully designed components built with Radix UI and
                      Tailwind CSS.
                    </p>
                  </a>
                </NavigationMenuLink>
              </li>
              {gettingStartedItems.map((item) => (
                <ListItem key={item.title} title={item.title} href={item.href}>
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {componentsItems.map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/docs">
            Documentation
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const SimpleLinks: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/home">
            Home
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/about">
            About
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/services">
            Services
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/contact">
            Contact
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const WithCards: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Analytics</CardTitle>
                  <CardDescription>
                    Track your website performance and user behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">Popular</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Marketing</CardTitle>
                  <CardDescription>
                    Grow your audience with our marketing tools.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">New</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">E-commerce</CardTitle>
                  <CardDescription>
                    Build and manage your online store.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Support</CardTitle>
                  <CardDescription>
                    Get help from our support team.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/pricing">
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const WithExamples: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Examples</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 md:w-[400px] lg:w-[600px] lg:grid-cols-2">
              {examples.map((example) => (
                <div
                  key={example.name}
                  className="group grid h-auto w-full items-center justify-start gap-1 rounded-md p-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                >
                  <div className="text-sm font-medium leading-none group-hover:underline">
                    {example.name}
                  </div>
                  <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                    View the source code for this example.
                  </div>
                </div>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/blocks">
            Blocks
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const Vertical: Story = {
  render: () => (
    <NavigationMenu orientation="vertical" className="max-w-none">
      <NavigationMenuList className="flex-col items-start space-x-0 space-y-1">
        <NavigationMenuItem className="w-full">
          <NavigationMenuTrigger className="w-full justify-start">
            Getting started
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 w-[400px]">
              {gettingStartedItems.map((item) => (
                <ListItem key={item.title} title={item.title} href={item.href}>
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem className="w-full">
          <NavigationMenuTrigger className="w-full justify-start">
            Components
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:grid-cols-2">
              {componentsItems.slice(0, 4).map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem className="w-full">
          <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), 'w-full justify-start')} href="/docs">
            Documentation
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const WithIndicator: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Features</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 md:w-[400px] lg:w-[500px]">
              <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none">Core Features</h4>
                <p className="text-sm text-muted-foreground">
                  Essential tools to get you started.
                </p>
              </div>
              <div className="grid gap-2">
                {['Authentication', 'Database', 'File Storage', 'Real-time'].map((feature) => (
                  <NavigationMenuLink
                    key={feature}
                    className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    href={`/features/${feature.toLowerCase().replace(' ', '-')}`}
                  >
                    {feature}
                  </NavigationMenuLink>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 md:w-[400px] lg:w-[500px]">
              <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none">Solutions</h4>
                <p className="text-sm text-muted-foreground">
                  Pre-built solutions for common use cases.
                </p>
              </div>
              <div className="grid gap-2">
                {['E-commerce', 'Social Media', 'Blog', 'Portfolio'].map((solution) => (
                  <NavigationMenuLink
                    key={solution}
                    className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    href={`/solutions/${solution.toLowerCase().replace(' ', '-')}`}
                  >
                    {solution}
                  </NavigationMenuLink>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/pricing">
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuIndicator />
    </NavigationMenu>
  ),
};

export const LargeContent: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Mega Menu</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-6 p-6 md:w-[600px] lg:w-[800px] lg:grid-cols-3">
              <div className="space-y-3">
                <h4 className="text-sm font-medium leading-none">Product</h4>
                <div className="grid gap-2">
                  {['Features', 'Integrations', 'Pricing', 'Changelog', 'Security'].map((item) => (
                    <NavigationMenuLink
                      key={item}
                      className="block select-none rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-sm"
                      href={`/${item.toLowerCase()}`}
                    >
                      {item}
                    </NavigationMenuLink>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium leading-none">Developers</h4>
                <div className="grid gap-2">
                  {['API Reference', 'SDKs', 'Tutorials', 'Examples', 'Community'].map((item) => (
                    <NavigationMenuLink
                      key={item}
                      className="block select-none rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-sm"
                      href={`/developers/${item.toLowerCase().replace(' ', '-')}`}
                    >
                      {item}
                    </NavigationMenuLink>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium leading-none">Company</h4>
                <div className="grid gap-2">
                  {['About', 'Blog', 'Careers', 'Contact', 'Press'].map((item) => (
                    <NavigationMenuLink
                      key={item}
                      className="block select-none rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-sm"
                      href={`/company/${item.toLowerCase()}`}
                    >
                      {item}
                    </NavigationMenuLink>
                  ))}
                </div>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/docs">
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/support">
            Support
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const WithActions: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Account</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 w-[300px]">
              <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none">Welcome back, John!</h4>
                <p className="text-sm text-muted-foreground">
                  Manage your account and preferences.
                </p>
              </div>
              <div className="grid gap-2">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  href="/profile"
                >
                  <div className="text-sm font-medium">Profile</div>
                  <p className="text-sm text-muted-foreground">
                    View and edit your profile information.
                  </p>
                </NavigationMenuLink>
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  href="/settings"
                >
                  <div className="text-sm font-medium">Settings</div>
                  <p className="text-sm text-muted-foreground">
                    Configure your preferences.
                  </p>
                </NavigationMenuLink>
              </div>
              <div className="border-t pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  Sign out
                </Button>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/dashboard">
            Dashboard
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const Disabled: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Available</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px]">
              <ListItem title="Available Feature" href="/available">
                This feature is currently available.
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger disabled>Coming Soon</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px]">
              <ListItem title="Future Feature" href="/coming-soon">
                This feature will be available soon.
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "opacity-50 cursor-not-allowed")} 
            href="/disabled"
            onClick={(e) => e.preventDefault()}
          >
            Disabled Link
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const CustomStyling: Story = {
  render: () => (
    <NavigationMenu className="border rounded-lg p-2">
      <NavigationMenuList className="space-x-2">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-primary text-primary-foreground hover:bg-primary/90">
            Custom Theme
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 w-[300px] bg-primary/5">
              <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none text-primary">Custom Content</h4>
                <p className="text-sm text-muted-foreground">
                  This navigation menu has custom styling applied.
                </p>
              </div>
              <div className="grid gap-2">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                  href="/custom-1"
                >
                  Custom Link 1
                </NavigationMenuLink>
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                  href="/custom-2"
                >
                  Custom Link 2
                </NavigationMenuLink>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "bg-secondary text-secondary-foreground hover:bg-secondary/90")} 
            href="/styled"
          >
            Styled Link
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

export const ControlledNavigation: Story = {
  render: () => {
    const [value, setValue] = useState('');

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Current value: <code>{value || 'none'}</code>
        </div>
        <NavigationMenu value={value} onValueChange={setValue}>
          <NavigationMenuList>
            <NavigationMenuItem value="getting-started">
              <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px]">
                  {gettingStartedItems.map((item) => (
                    <ListItem key={item.title} title={item.title} href={item.href}>
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem value="components">
              <NavigationMenuTrigger>Components</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:grid-cols-2">
                  {componentsItems.slice(0, 4).map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      href={component.href}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="/docs">
                Documentation
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setValue('getting-started')}
          >
            Open Getting Started
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setValue('components')}
          >
            Open Components
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setValue('')}
          >
            Close All
          </Button>
        </div>
      </div>
    );
  },
};

export const MobileResponsive: Story = {
  render: () => (
    <NavigationMenu className="w-full max-w-none">
      <NavigationMenuList className="flex-wrap justify-start">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="text-xs sm:text-sm">
            Products
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-3 p-4 w-[280px] sm:w-[400px] lg:w-[500px]">
              <div className="space-y-2">
                <h4 className="text-sm font-medium leading-none">Our Products</h4>
                <p className="text-sm text-muted-foreground">
                  Explore our range of products and services.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {['Analytics', 'Marketing', 'Support', 'Sales'].map((product) => (
                  <NavigationMenuLink
                    key={product}
                    className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    href={`/products/${product.toLowerCase()}`}
                  >
                    <div className="text-sm font-medium">{product}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Learn more about {product.toLowerCase()}.
                    </p>
                  </NavigationMenuLink>
                ))}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "text-xs sm:text-sm")} 
            href="/pricing"
          >
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "text-xs sm:text-sm")} 
            href="/about"
          >
            About
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "text-xs sm:text-sm")} 
            href="/contact"
          >
            Contact
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};