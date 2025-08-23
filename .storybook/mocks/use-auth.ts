// Mock for useAuth hook in Storybook
import { fn } from '@storybook/test';

// Default mock state - logged out
let mockAuthState = {
  isLoggedIn: false,
  loading: false,
  user: null,
  signInWithGitHub: fn(),
  signOut: fn(),
};

// Function to update mock state
export const setMockAuthState = (state: typeof mockAuthState) => {
  mockAuthState = state;
};

// Mock hook
export const useAuth = () => mockAuthState;