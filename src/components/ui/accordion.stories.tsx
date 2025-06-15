import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

interface AccordionArgs {
  type?: "single" | "multiple";
  collapsible?: boolean;
  className?: string;
}

const meta: Meta<AccordionArgs> = {
  title: "UI/Navigation/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A vertically stacked set of interactive headings that reveal or hide sections of content.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    type: {
      control: { type: "select" },
      options: ["single", "multiple"],
    },
    collapsible: {
      control: { type: "boolean" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes. It comes with default styles that match the other components'
          aesthetic.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is it animated?</AccordionTrigger>
        <AccordionContent>
          Yes. It's animated by default, but you can disable it if you prefer.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple: Story = {
  args: {},
  render: () => (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Can I open multiple items?</AccordionTrigger>
        <AccordionContent>
          Yes! This accordion allows multiple items to be open at the same time.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How do I enable this?</AccordionTrigger>
        <AccordionContent>
          Set the type prop to "multiple" on the Accordion component.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Any other benefits?</AccordionTrigger>
        <AccordionContent>
          Users can compare content between sections more easily when multiple
          items are open.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const FAQ: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="faq-1">
        <AccordionTrigger>What is your return policy?</AccordionTrigger>
        <AccordionContent>
          We offer a 30-day return policy for all items. Items must be in
          original condition with tags attached. Return shipping is free for
          defective items, otherwise customer is responsible for return shipping
          costs.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-2">
        <AccordionTrigger>How long does shipping take?</AccordionTrigger>
        <AccordionContent>
          Standard shipping takes 3-7 business days. Express shipping (1-2
          business days) and overnight shipping options are available at
          checkout for an additional fee.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-3">
        <AccordionTrigger>Do you ship internationally?</AccordionTrigger>
        <AccordionContent>
          Yes, we ship to over 50 countries worldwide. International shipping
          costs and delivery times vary by destination. Customers are
          responsible for any customs duties or taxes.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-4">
        <AccordionTrigger>How can I track my order?</AccordionTrigger>
        <AccordionContent>
          Once your order ships, you'll receive a tracking number via email. You
          can also log into your account to view order status and tracking
          information.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Features: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="feature-1">
        <AccordionTrigger>🚀 Performance</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <p>Our platform is built for speed and efficiency:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Lightning-fast load times</li>
              <li>Optimized for mobile devices</li>
              <li>CDN-powered global delivery</li>
              <li>99.9% uptime guarantee</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="feature-2">
        <AccordionTrigger>🔒 Security</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <p>Your data is protected with enterprise-grade security:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>End-to-end encryption</li>
              <li>Regular security audits</li>
              <li>GDPR & SOC 2 compliance</li>
              <li>Two-factor authentication</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="feature-3">
        <AccordionTrigger>🎨 Customization</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <p>Tailor the experience to your needs:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Custom themes and branding</li>
              <li>Flexible API integrations</li>
              <li>White-label solutions</li>
              <li>Advanced workflow automation</li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Documentation: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="getting-started">
        <AccordionTrigger>Getting Started</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <p>Welcome! Here's how to get started:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Create your account</li>
              <li>Complete the onboarding process</li>
              <li>Import your data</li>
              <li>Customize your settings</li>
              <li>Invite your team members</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-2">
              Need help? Check out our detailed guides or contact support.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="api-reference">
        <AccordionTrigger>API Reference</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <p>Our REST API provides programmatic access to your data:</p>
            <div className="bg-muted p-3 rounded-md text-sm font-mono">
              GET https://api.example.com/v1/users
            </div>
            <p className="text-sm">
              Authentication is required for all API calls. Include your API key
              in the Authorization header.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="troubleshooting">
        <AccordionTrigger>Troubleshooting</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <p>Common issues and solutions:</p>
            <div className="space-y-2">
              <div>
                <h5 className="font-medium text-sm">Login Problems</h5>
                <p className="text-sm text-muted-foreground">
                  Clear your browser cache and cookies, then try again.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-sm">Data Not Syncing</h5>
                <p className="text-sm text-muted-foreground">
                  Check your internet connection and refresh the page.
                </p>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const WithDefaultOpen: Story = {
  args: {},
  render: () => (
    <Accordion
      type="single"
      collapsible
      defaultValue="item-2"
      className="w-full"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>First Item</AccordionTrigger>
        <AccordionContent>
          This is the first accordion item, but it starts closed.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Second Item (Default Open)</AccordionTrigger>
        <AccordionContent>
          This accordion item is open by default because we set
          defaultValue="item-2" on the Accordion component.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Third Item</AccordionTrigger>
        <AccordionContent>
          This is the third accordion item, also starting closed.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const AccordionInteraction: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes. It comes with default styles that matches the other components.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is it animated?</AccordionTrigger>
        <AccordionContent>
          Yes. It's animated by default, but you can disable it if you prefer.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find accordion triggers
    const trigger1 = canvas.getByRole("button", { name: "Is it accessible?" });
    const trigger2 = canvas.getByRole("button", { name: "Is it styled?" });
    const trigger3 = canvas.getByRole("button", { name: "Is it animated?" });

    // All items should be collapsed initially
    await expect(trigger1).toHaveAttribute("aria-expanded", "false");
    await expect(trigger2).toHaveAttribute("aria-expanded", "false");
    await expect(trigger3).toHaveAttribute("aria-expanded", "false");

    // Click first item to expand
    await userEvent.click(trigger1);
    await expect(trigger1).toHaveAttribute("aria-expanded", "true");

    // Check that content is visible
    const content1 = canvas.getByText(
      "Yes. It adheres to the WAI-ARIA design pattern."
    );
    await expect(content1).toBeVisible();

    // Click second item - first should collapse (single mode)
    await userEvent.click(trigger2);
    await expect(trigger1).toHaveAttribute("aria-expanded", "false");
    await expect(trigger2).toHaveAttribute("aria-expanded", "true");

    // Click same item to collapse
    await userEvent.click(trigger2);
    await expect(trigger2).toHaveAttribute("aria-expanded", "false");
  },
  tags: ["interaction"],
};

export const AccordionKeyboardNavigation: Story = {
  args: {},
  render: () => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="keyboard-1">
        <AccordionTrigger>First Item</AccordionTrigger>
        <AccordionContent>Content for the first item.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="keyboard-2">
        <AccordionTrigger>Second Item</AccordionTrigger>
        <AccordionContent>Content for the second item.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger1 = canvas.getByRole("button", { name: "First Item" });
    const trigger2 = canvas.getByRole("button", { name: "Second Item" });

    // Focus first trigger
    trigger1.focus();
    await expect(trigger1).toHaveFocus();

    // Test keyboard navigation
    await userEvent.keyboard("{ArrowDown}");
    await expect(trigger2).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    await expect(trigger1).toHaveFocus();

    // Test Enter/Space to expand
    await userEvent.keyboard("{Enter}");
    await expect(trigger1).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard(" ");
    await expect(trigger1).toHaveAttribute("aria-expanded", "false");
  },
  tags: ["interaction", "accessibility"],
};

export const AccordionMultiple: Story = {
  args: {},
  render: () => (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value="multi-1">
        <AccordionTrigger>Multiple Item 1</AccordionTrigger>
        <AccordionContent>
          This accordion allows multiple items to be open at once.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="multi-2">
        <AccordionTrigger>Multiple Item 2</AccordionTrigger>
        <AccordionContent>
          You can expand both this and the first item.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger1 = canvas.getByRole("button", { name: "Multiple Item 1" });
    const trigger2 = canvas.getByRole("button", { name: "Multiple Item 2" });

    // Expand first item
    await userEvent.click(trigger1);
    await expect(trigger1).toHaveAttribute("aria-expanded", "true");

    // Expand second item - first should remain expanded (multiple mode)
    await userEvent.click(trigger2);
    await expect(trigger1).toHaveAttribute("aria-expanded", "true");
    await expect(trigger2).toHaveAttribute("aria-expanded", "true");

    // Both contents should be visible
    const content1 = canvas.getByText(
      "This accordion allows multiple items to be open at once."
    );
    const content2 = canvas.getByText(
      "You can expand both this and the first item."
    );
    await expect(content1).toBeVisible();
    await expect(content2).toBeVisible();
  },
  tags: ["interaction"],
};
