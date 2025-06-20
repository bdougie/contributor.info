import type { TestRunnerConfig } from '@storybook/test-runner';
import { waitFor } from '@testing-library/react';

const config: TestRunnerConfig = {
  // Setup for interaction tests
  async setup() {
    // Global test setup
    // Note: Storybook test-runner uses Playwright/Jest internally,
    // but our component tests use Vitest
    
    // Set up environment variables
    if (typeof process !== 'undefined' && process.env) {
      process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
      process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
    }
  },
  
  // Tags to include/exclude  
  tags: {
    include: ['test', 'interaction'],
    exclude: ['skip-test'],
  },

  // Custom page setup for better portal handling
  async preVisit(page) {
    // Set environment variables in the browser context
    await page.addInitScript(() => {
      // Mock environment variables for Supabase
      // Create a polyfill for import.meta.env
      (window as any).import = (window as any).import || {};
      (window as any).import.meta = (window as any).import.meta || {};
      (window as any).import.meta.env = {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
        MODE: 'test',
        DEV: false,
        PROD: false,
        SSR: false
      };
    });
    
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

      // Cleanup helper for between tests
      window.cleanupTestEnvironment = () => {
        // Remove any leftover portal elements
        const portals = document.querySelectorAll('[data-radix-portal], [data-portal], .portal-root');
        portals.forEach(portal => portal.remove());
        
        // Clear any open dialogs/modals
        const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
        dialogs.forEach(dialog => dialog.remove());
        
        // Reset focus to body
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        
        // Clear any leftover event listeners by resetting body
        const body = document.body;
        body.removeAttribute('style');
        body.removeAttribute('data-scroll-locked');
        
        // Reset any CSS custom properties that might affect tests
        const root = document.documentElement;
        root.style.removeProperty('--removed-body-scroll-bar-size');
        
        // Clear any toast notifications or floating elements
        const toasts = document.querySelectorAll('[data-sonner-toaster]');
        toasts.forEach(toast => toast.remove());
      };
    });
  },

  // Post-test cleanup
  async postVisit(page) {
    // Clean up after each story test
    await page.evaluate(() => {
      if (window.cleanupTestEnvironment) {
        window.cleanupTestEnvironment();
      }
    });
    
    // Wait for cleanup to complete
    await page.waitForTimeout(100);
  },

  // Configure test timeouts
  testTimeout: 30000,
  
  // Retry configuration for flaky tests
  retries: 1,
};

export default config;
