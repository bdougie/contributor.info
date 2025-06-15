import { waitFor, screen } from '@storybook/test';

/**
 * Test utilities for Storybook interaction tests
 * Handles portal components and async state changes
 */

/**
 * Waits for a portal element (like Dialog, AlertDialog) to appear
 * Uses screen queries instead of canvas to find elements outside storybook-root
 */
export const waitForPortalElement = async (
  role: string, 
  options: { name?: string; timeout?: number } = {}
) => {
  const { name, timeout = 5000 } = options;
  
  return waitFor(
    () => {
      const element = name 
        ? screen.getByRole(role as any, { name })
        : screen.getByRole(role as any);
      return element;
    },
    { timeout }
  );
};

/**
 * Waits for a modal/dialog to be fully visible and interactive
 */
export const waitForModalOpen = async (timeout = 5000) => {
  return waitFor(
    () => {
      const dialog = screen.queryByRole('dialog') || screen.queryByRole('alertdialog');
      if (!dialog) {
        throw new Error('Modal not found');
      }
      
      // Check if modal is visible and interactive
      const style = getComputedStyle(dialog);
      if (style.display === 'none' || style.visibility === 'hidden') {
        throw new Error('Modal not visible');
      }
      
      return dialog;
    },
    { timeout }
  );
};

/**
 * Waits for a select dropdown to open and options to be available
 */
export const waitForSelectOpen = async (timeout = 5000) => {
  return waitFor(
    () => {
      const listbox = screen.getByRole('listbox');
      return listbox;
    },
    { timeout }
  );
};

/**
 * Waits for an element to receive focus
 */
export const waitForFocus = async (element: HTMLElement, timeout = 2000) => {
  return waitFor(
    () => {
      if (document.activeElement !== element) {
        throw new Error('Element does not have focus');
      }
      return element;
    },
    { timeout }
  );
};

/**
 * Waits for an element to lose focus  
 */
export const waitForBlur = async (element: HTMLElement, timeout = 2000) => {
  return waitFor(
    () => {
      if (document.activeElement === element) {
        throw new Error('Element still has focus');
      }
      return true;
    },
    { timeout }
  );
};

/**
 * Waits for text content to change to expected value
 */
export const waitForTextContent = async (
  element: HTMLElement, 
  expectedText: string, 
  timeout = 3000
) => {
  return waitFor(
    () => {
      if (element.textContent?.trim() !== expectedText.trim()) {
        throw new Error(`Expected "${expectedText}" but got "${element.textContent}"`);
      }
      return element;
    },
    { timeout }
  );
};

/**
 * Waits for an element to disappear (useful for modal close animations)
 */
export const waitForElementToDisappear = async (
  getElement: () => HTMLElement | null,
  timeout = 3000
) => {
  return waitFor(
    () => {
      const element = getElement();
      if (element) {
        throw new Error('Element is still present');
      }
      return true;
    },
    { timeout }
  );
};