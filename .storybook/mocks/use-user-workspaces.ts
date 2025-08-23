// Mock for use-user-workspaces hook in Storybook
import { fn } from "@storybook/test";

export const usePrimaryWorkspace = fn(() => ({
  workspace: null,
  hasWorkspace: false,
  loading: false,
  error: null,
  refetch: fn(),
}));

export const useUserWorkspaces = fn(() => ({
  workspaces: [],
  loading: false,
  error: null,
  refetch: fn(),
}));