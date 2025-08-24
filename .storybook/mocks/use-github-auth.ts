import { fn } from "@storybook/test";

const stableLogin = fn();
const stableLogout = fn();
const stableCheckSession = fn();
const stableSetShowLoginDialog = fn();

export const useGitHubAuth = () => {
  const storyId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : '';
  
  const isLoggedIn = storyId?.includes('logged-in') || false;
  const isLoading = storyId?.includes('auth-loading') || false;
  
  return {
    isLoggedIn,
    loading: isLoading,
    user: isLoggedIn ? { id: 'user-1', email: 'user@example.com' } : null,
    login: stableLogin,
    logout: stableLogout,
    checkSession: stableCheckSession,
    showLoginDialog: false,
    setShowLoginDialog: stableSetShowLoginDialog,
  };
};