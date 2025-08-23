// Mock for usePrimaryWorkspace hook in Storybook

// Default mock state - no workspace
let mockWorkspaceState = {
  workspace: null,
  hasWorkspace: false,
  loading: false,
  error: null,
};

// Function to update mock state
export const setMockWorkspaceState = (state: typeof mockWorkspaceState) => {
  mockWorkspaceState = state;
};

// Mock hook
export const usePrimaryWorkspace = () => mockWorkspaceState;

// Also export useUserWorkspaces for completeness
export const useUserWorkspaces = () => ({
  workspaces: mockWorkspaceState.workspace ? [mockWorkspaceState.workspace] : [],
  loading: mockWorkspaceState.loading,
  error: mockWorkspaceState.error,
  refetch: async () => {},
});