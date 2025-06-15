import type { TestRunnerConfig } from '@storybook/test-runner';
import { waitFor } from '@testing-library/react';

const config: TestRunnerConfig = {
  // Setup for interaction tests
  setup() {
    // Global test setup
    // Increase timeout for portal rendering
    jest.setTimeout(30000);
  },
  
  // Tags to include/exclude  
  tags: {
    include: ['test', 'interaction'],
    exclude: ['skip-test'],
  },

  // Custom page setup for better portal handling
  async preRender(page) {
    // Add custom test utilities to the page
    await page.addInitScript(() => {
      // Helper function to wait for elements outside the canvas
      window.waitForPortalElement = async (role, options = {}) => {
        const { timeout = 5000 } = options;
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          
          const check = () => {
            const element = document.querySelector(`[role="${role}"]`);
            if (element) {
              resolve(element);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Portal element with role "${role}" not found within ${timeout}ms`));
            } else {
              setTimeout(check, 100);
            }
          };
          
          check();
        });
      };

      // Helper to wait for dialog/modal to be fully rendered
      window.waitForModalOpen = async (timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          
          const check = () => {
            const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
            const isVisible = dialog && 
              getComputedStyle(dialog).display !== 'none' &&
              getComputedStyle(dialog).visibility !== 'hidden';
              
            if (isVisible) {
              // Wait a bit more for animations to complete
              setTimeout(() => resolve(dialog), 100);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Modal not visible within ${timeout}ms`));
            } else {
              setTimeout(check, 100);
            }
          };
          
          check();
        });
      };
    });
  },

  // Configure test timeouts
  testTimeout: 30000,
};

export default config;
