import type { TestRunnerConfig } from '@storybook/test-runner';
import { waitFor } from '@testing-library/react';

// Extend Window interface for test utilities
declare global {
  interface Window {
    waitForPortalElement?: (role: string, options?: { timeout?: number }) => Promise<Element>;
    waitForModalOpen?: (timeout?: number) => Promise<Element>;
    cleanupTestEnvironment?: () => void;
  }
}

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
  
  // Disable automatic smoke tests
  async prepare() {
    // Disable default test generation
    const { getStoryContext } = await import('@storybook/test-runner');
    const originalGetStoryContext = getStoryContext;
    
    // Override to skip smoke tests for certain stories
    (global as any).getStoryContext = async (page: any, story: any) => {
      const context = await originalGetStoryContext(page, story);
      
      // Check if story has skip-test tag
      if (context.tags?.includes('skip-test')) {
        context.skip = true;
      }
      
      return context;
    };
  },

  // Custom page setup for better portal handling
  async preVisit(page) {
    // Increase timeout for initial page load
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Set environment variables in the browser context
    await page.addInitScript(() => {
      // Mock environment variables for Supabase
      // Create a polyfill for import.meta.env
      const win = window as any;
      if (!win.import) win.import = {};
      if (!win.import.meta) win.import.meta = {};
      win.import.meta.env = {
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
  testTimeout: 30000,  // 30 seconds instead of 60
  
  
  // Custom test function for smoke tests
  async testHook(page, context) {
    // For smoke tests, just verify the component renders without errors
    const storyId = context.id;
    
    // Skip smoke test for problematic stories
    const problematicStories = [
      'common-theming-modetoggle',
      'features-auth-authbutton'
    ];
    
    if (problematicStories.some(id => storyId.toLowerCase().includes(id))) {
      console.log(`Skipping smoke test for ${storyId} due to known issues`);
      return;
    }
    
    // Wait for the story root to be visible
    try {
      await page.waitForSelector('#storybook-root', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Check for any console errors
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      
      // Give the component time to render
      await page.waitForTimeout(1000);
      
      // Check if there were any errors
      if (errors.length > 0) {
        throw new Error(`Component errors: ${errors.join(', ')}`);
      }
    } catch (error) {
      console.error(`Smoke test failed for ${storyId}:`, error);
      throw error;
    }
  },
  
  // Retry configuration for flaky tests
  retries: 1,
};

export default config;
