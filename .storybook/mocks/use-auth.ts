// Mock for use-auth hook in Storybook
import { fn } from "@storybook/test";

export const useAuth = fn(() => ({
  isLoggedIn: false,
  loading: false,
  login: fn(),
  logout: fn(),
  checkSession: fn(),
  showLoginDialog: false,
  setShowLoginDialog: fn(),
}));