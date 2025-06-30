// Mock for use-github-auth hook in Storybook
import { fn } from "@storybook/test";

export const useGitHubAuth = fn(() => ({
  login: fn(),
  isLoggedIn: false,
  loading: false,
  logout: fn(),
  checkSession: fn(),
  showLoginDialog: false,
  setShowLoginDialog: fn(),
}));