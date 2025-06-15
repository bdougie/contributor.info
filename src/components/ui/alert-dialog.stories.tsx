import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, screen } from "@storybook/test";
import { waitForPortalElement, waitForElementToDisappear } from "@/lib/test-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

const meta = {
  title: "UI/Overlay/AlertDialog",
  component: AlertDialog,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A modal dialog that interrupts the user with important content and expects a response.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Show Dialog</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const Destructive: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete your account? This action cannot be
            undone. All your data will be permanently removed from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const Confirmation: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>Save Changes</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save Changes</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to save the changes you made? Your changes will be lost
            if you don't save them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Don't Save</AlertDialogCancel>
          <AlertDialogAction>Save Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const LongContent: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Terms & Conditions</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terms and Conditions</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="max-h-[300px] overflow-y-auto">
              <p className="mb-4">
                By using this service, you agree to the following terms and
                conditions:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>You must be at least 18 years old to use this service.</li>
                <li>
                  You are responsible for maintaining the confidentiality of
                  your account.
                </li>
                <li>
                  You agree not to use the service for any unlawful purposes.
                </li>
                <li>
                  We reserve the right to terminate your account at any time.
                </li>
                <li>
                  All content you submit must comply with our community
                  guidelines.
                </li>
                <li>
                  We may update these terms at any time without prior notice.
                </li>
                <li>Your use of the service is at your own risk.</li>
                <li>
                  We are not liable for any damages resulting from your use of
                  the service.
                </li>
                <li>
                  These terms are governed by the laws of your jurisdiction.
                </li>
                <li>
                  Any disputes will be resolved through binding arbitration.
                </li>
              </ol>
              <p className="mt-4 text-sm">
                Last updated: December 2024. Please review these terms regularly
                as they may change.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Decline</AlertDialogCancel>
          <AlertDialogAction>Accept Terms</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const Warning: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="border-yellow-500 text-yellow-600">
          Proceed with Caution
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-yellow-500"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="m12 17 .01 0" />
            </svg>
            Warning
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to perform an action that may have unintended
            consequences. Please review your selection carefully before
            proceeding.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Go Back</AlertDialogCancel>
          <AlertDialogAction className="bg-yellow-500 text-yellow-50 hover:bg-yellow-600">
            Proceed Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const SimpleConfirm: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm">Quick Confirm</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Action</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction>Yes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const CustomActions: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Custom Actions</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your work</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:space-y-2">
          <AlertDialogAction>Save and Continue</AlertDialogAction>
          <AlertDialogAction className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Save as Draft
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const AlertDialogInteraction: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Yes, delete account</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click the trigger button
    const trigger = canvas.getByRole("button", { name: "Delete Account" });
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);

    // Wait for alert dialog to open (use screen for portal elements)
    const dialog = await waitForPortalElement("alertdialog");
    await expect(dialog).toBeInTheDocument();

    // Check dialog content using screen queries
    const title = screen.getByRole("heading", {
      name: "Are you absolutely sure?",
    });
    await expect(title).toBeInTheDocument();

    const description = screen.getByText(/This action cannot be undone/);
    await expect(description).toBeInTheDocument();

    // Test cancel action
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeInTheDocument();
    await userEvent.click(cancelButton);

    // Wait for dialog to close
    await waitForElementToDisappear(() => screen.queryByRole("alertdialog"));
  },
  tags: ["interaction"],
};

export const AlertDialogConfirmAction: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Confirm Action</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your action</AlertDialogTitle>
          <AlertDialogDescription>
            Please confirm that you want to proceed with this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open alert dialog
    const trigger = canvas.getByRole("button", { name: "Confirm Action" });
    await userEvent.click(trigger);

    // Wait for alert dialog to open
    await waitForPortalElement("alertdialog");

    // Test confirm action
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    await expect(confirmButton).toBeInTheDocument();
    await userEvent.click(confirmButton);

    // Wait for dialog to close after confirmation
    await waitForElementToDisappear(() => screen.queryByRole("alertdialog"));
  },
  tags: ["interaction"],
};

export const AlertDialogKeyboardNavigation: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>Keyboard Test</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keyboard Navigation</AlertDialogTitle>
          <AlertDialogDescription>
            Test keyboard navigation in alert dialog.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByRole("button", { name: "Keyboard Test" });
    await userEvent.click(trigger);

    // Wait for alert dialog to open with longer timeout
    const dialog = await waitForPortalElement("alertdialog", { timeout: 10000 });
    await expect(dialog).toBeInTheDocument();

    // Wait for dialog to be fully rendered and interactive
    await new Promise(resolve => setTimeout(resolve, 200));

    // Test Tab navigation between buttons using screen queries
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const okButton = screen.getByRole("button", { name: "OK" });
    
    // Check what currently has focus
    const currentFocused = document.activeElement;
    
    if (currentFocused === okButton) {
      // OK button is already focused, verify and continue
      await expect(okButton).toHaveFocus();
      
      await userEvent.keyboard("{Tab}");
      await new Promise(resolve => setTimeout(resolve, 100));
      await expect(cancelButton).toHaveFocus();
    } else {
      // Start with Tab to move to first button
      await userEvent.keyboard("{Tab}");
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check which button got focus
      if (document.activeElement === cancelButton) {
        await expect(cancelButton).toHaveFocus();
        
        await userEvent.keyboard("{Tab}");
        await new Promise(resolve => setTimeout(resolve, 100));
        await expect(okButton).toHaveFocus();
      } else {
        await expect(okButton).toHaveFocus();
        
        await userEvent.keyboard("{Tab}");
        await new Promise(resolve => setTimeout(resolve, 100));
        await expect(cancelButton).toHaveFocus();
      }
    }

    // Test Escape key closes dialog
    await userEvent.keyboard("{Escape}");
    
    // Wait for dialog to close
    await waitForElementToDisappear(() => screen.queryByRole("alertdialog"));
  },
  tags: ["interaction", "accessibility"],
};
