import { waitFor, screen } from '@storybook/test';

/**
 * Test utilities for Storybook interaction tests
 * Handles portal components and async state changes
 */

/**
 * Enhanced error logging for test debugging
 */
const logTestError = (context: string, error: Error, additionalInfo?: any) => {
  console.error(`[Test Utils] ${context}:`, {
    error: error.message,
    stack: error.stack,
    additionalInfo,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Waits for a portal element (like Dialog, AlertDialog) to appear
 * Uses screen queries instead of canvas to find elements outside storybook-root
 */
export const waitForPortalElement = async (
  role: string, 
  options: { name?: string; timeout?: number } = {}
) => {
  const { name, timeout = 5000 } = options;
  
  try {
    return await waitFor(
      () => {
        try {
          const element = name 
            ? screen.getByRole(role as any, { name })
            : screen.getByRole(role as any);
          return element;
        } catch (queryError) {
          // Provide helpful debugging information
          const availableRoles = document.querySelectorAll('[role]');
          const roleList = Array.from(availableRoles)
            .map(el => el.getAttribute('role'))
            .filter(Boolean);
          
          throw new Error(
            `Could not find element with role "${role}"${name ? ` and name "${name}"` : ''}. ` +
            `Available roles: ${roleList.join(', ')}`
          );
        }
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForPortalElement', error as Error, { role, name, timeout });
    throw error;
  }
};

/**
 * Waits for a modal/dialog to be fully visible and interactive
 */
export const waitForModalOpen = async (timeout = 5000) => {
  try {
    return await waitFor(
      () => {
        const dialog = screen.queryByRole('dialog') || screen.queryByRole('alertdialog');
        if (!dialog) {
          // Get detailed DOM state for debugging
          const allElements = document.querySelectorAll('[role*="dialog"], [data-state], [data-radix-dialog]');
          const elementInfo = Array.from(allElements).map(el => ({
            tagName: el.tagName,
            role: el.getAttribute('role'),
            state: el.getAttribute('data-state'),
            className: el.className,
          }));
          
          throw new Error(
            `Modal not found. Available dialog-related elements: ${JSON.stringify(elementInfo, null, 2)}`
          );
        }
        
        // Check if modal is visible and interactive
        const style = getComputedStyle(dialog);
        if (style.display === 'none' || style.visibility === 'hidden') {
          throw new Error(
            `Modal found but not visible. Style: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`
          );
        }
        
        return dialog;
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForModalOpen', error as Error, { timeout });
    throw error;
  }
};

/**
 * Waits for a select dropdown to open and options to be available
 */
export const waitForSelectOpen = async (timeout = 5000) => {
  try {
    return await waitFor(
      () => {
        // Check for Radix UI Select content portal
        const selectContent = document.querySelector('[data-radix-select-content]');
        if (selectContent) {
          // Check if it's visible and has the open state
          const isOpen = selectContent.getAttribute('data-state') === 'open';
          const isVisible = getComputedStyle(selectContent).display !== 'none';
          
          if (isOpen && isVisible) {
            return selectContent;
          }
        }

        // Fallback: try to find listbox role
        try {
          const listbox = screen.getByRole('listbox');
          return listbox;
        } catch (queryError) {
          // Check for select-related elements for debugging
          const selectElements = document.querySelectorAll('select, [data-radix-select], [role="combobox"], [data-radix-select-content]');
          const elementInfo = Array.from(selectElements).map(el => ({
            tagName: el.tagName,
            role: el.getAttribute('role'),
            state: el.getAttribute('data-state'),
            expanded: el.getAttribute('aria-expanded'),
            visible: getComputedStyle(el).display !== 'none',
          }));
          
          throw new Error(
            `Select dropdown not found or not open. Available select-related elements: ${JSON.stringify(elementInfo, null, 2)}`
          );
        }
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForSelectOpen', error as Error, { timeout });
    throw error;
  }
};

/**
 * Waits for an element to receive focus
 */
export const waitForFocus = async (element: HTMLElement, timeout = 2000) => {
  try {
    return await waitFor(
      () => {
        if (document.activeElement !== element) {
          throw new Error(
            `Element does not have focus. Expected: ${element.tagName}#${element.id || 'no-id'}, ` +
            `Actual: ${document.activeElement?.tagName}#${document.activeElement?.id || 'no-id'}`
          );
        }
        return element;
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForFocus', error as Error, { 
      expectedElement: { tagName: element.tagName, id: element.id, className: element.className },
      actualElement: { 
        tagName: document.activeElement?.tagName, 
        id: document.activeElement?.id, 
        className: document.activeElement?.className 
      },
      timeout 
    });
    throw error;
  }
};

/**
 * Waits for an element to lose focus  
 */
export const waitForBlur = async (element: HTMLElement, timeout = 2000) => {
  try {
    return await waitFor(
      () => {
        if (document.activeElement === element) {
          throw new Error(
            `Element still has focus: ${element.tagName}#${element.id || 'no-id'}`
          );
        }
        return true;
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForBlur', error as Error, { 
      element: { tagName: element.tagName, id: element.id, className: element.className },
      timeout 
    });
    throw error;
  }
};

/**
 * Waits for text content to change to expected value
 */
export const waitForTextContent = async (
  element: HTMLElement, 
  expectedText: string, 
  timeout = 3000
) => {
  try {
    return await waitFor(
      () => {
        const actualText = element.textContent?.trim() || '';
        const expected = expectedText.trim();
        if (actualText !== expected) {
          throw new Error(
            `Text content mismatch. Expected: "${expected}", Actual: "${actualText}"`
          );
        }
        return element;
      },
      { timeout }
    );
  } catch (error) {
    logTestError('waitForTextContent', error as Error, { 
      element: { tagName: element.tagName, id: element.id, textContent: element.textContent },
      expectedText,
      timeout 
    });
    throw error;
  }
};

/**
 * Waits for an element to disappear (useful for modal close animations)
 */
export const waitForElementToDisappear = async (
  getElement: () => HTMLElement | null,
  timeout = 3000
) => {
  try {
    return await waitFor(
      () => {
        const element = getElement();
        if (element) {
          throw new Error(
            `Element is still present: ${element.tagName}#${element.id || 'no-id'}`
          );
        }
        return true;
      },
      { timeout }
    );
  } catch (error) {
    const element = getElement();
    logTestError('waitForElementToDisappear', error as Error, { 
      element: element
? { 
        tagName: element.tagName, 
        id: element.id, 
        className: element.className,
        display: getComputedStyle(element).display,
        visibility: getComputedStyle(element).visibility
      }
: null,
      timeout 
    });
    throw error;
  }
};

/**
 * Safe wrapper for common test operations with retry logic
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        console.warn(`[Test Utils] Operation failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logTestError('withRetry', lastError!, { maxRetries, delayMs });
  throw lastError!;
};