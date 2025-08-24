const mockWorkspaceData = {
  id: 'workspace-1',
  name: "bdougie's Projects",
  slug: 'bdougie-projects',
  description: 'A curated collection of open source projects I contribute to and maintain.',
  owner: {
    id: 'bdougie',
    avatar_url: 'https://github.com/bdougie.png',
    display_name: 'Brian Douglas',
  },
  repository_count: 12,
  member_count: 3,
  repositories: [
    {
      id: 'repo-1',
      full_name: 'continuedev/continue',
      name: 'continue',
      owner: 'continuedev',
      description: 'The open-source autopilot for software development',
      language: 'TypeScript',
      activity_score: 42,
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/continuedev.png',
      html_url: 'https://github.com/continuedev/continue',
    },
    {
      id: 'repo-2',
      full_name: 'vitejs/vite',
      name: 'vite',
      owner: 'vitejs',
      description: 'Next generation frontend tooling. It\'s fast!',
      language: 'JavaScript',
      activity_score: 28,
      last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/vitejs.png',
      html_url: 'https://github.com/vitejs/vite',
    },
    {
      id: 'repo-3',
      full_name: 'vercel/ai',
      name: 'ai',
      owner: 'vercel',
      description: 'Build AI-powered applications with React, Svelte, Vue, and Solid',
      language: 'TypeScript',
      activity_score: 15,
      last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/vercel.png',
      html_url: 'https://github.com/vercel/ai',
    },
  ],
  created_at: '2024-01-15T10:00:00Z',
};

export const usePrimaryWorkspace = () => {
  const storyId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : '';
  
  if (storyId?.includes('logged-in-with-workspace')) {
    return {
      workspace: mockWorkspaceData,
      hasWorkspace: true,
      loading: false,
      error: null,
    };
  }
  
  if (storyId?.includes('workspace-loading')) {
    return {
      workspace: null,
      hasWorkspace: false,
      loading: true,
      error: null,
    };
  }
  
  if (storyId?.includes('workspace-error')) {
    return {
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: new Error('Failed to load workspace'),
    };
  }
  
  return {
    workspace: null,
    hasWorkspace: false,
    loading: false,
    error: null,
  };
};

export const useUserWorkspaces = () => {
  const state = usePrimaryWorkspace();
  return {
    workspaces: state.workspace ? [state.workspace] : [],
    loading: state.loading,
    error: state.error,
    refetch: async () => {},
  };
};