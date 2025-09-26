// Mock Supabase client for Storybook
// This prevents the need for real Supabase credentials in CI/testing environments

// Ensure import.meta.env exists - mock environment for Storybook
if (typeof globalThis !== 'undefined' && typeof globalThis.import !== 'undefined') {
  const mockEnv = globalThis.import?.meta?.env || {};
  // Set mock environment variables to prevent errors
  if (!mockEnv.VITE_SUPABASE_URL) {
    mockEnv.VITE_SUPABASE_URL = 'http://localhost:54321';
  }
  if (!mockEnv.VITE_SUPABASE_ANON_KEY) {
    mockEnv.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
  }
}

const mockClient = {
  auth: {
    getSession: async () => ({
      data: { session: null },
      error: null,
    }),
    getUser: async () => ({
      data: { user: null },
      error: null,
    }),
    signInWithOAuth: async () => ({
      data: { url: 'http://mock-oauth-url', provider: 'github' },
      error: null,
    }),
    signOut: async () => ({
      error: null,
    }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      limit: () => Promise.resolve({ data: [], error: null }),
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  }),
  rpc: (functionName: string, params?: any) => {
    // Mock responses for specific RPC calls
    if (functionName === 'calculate_self_selection_rate') {
      return Promise.resolve({
        data: {
          external_contribution_rate: 65.5,
          internal_contribution_rate: 34.5,
          external_contributors: 25,
          internal_contributors: 10,
          total_contributors: 35,
          external_prs: 150,
          internal_prs: 75,
          total_prs: 225,
          analysis_period_days: params?.days_back || 30,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

export const createSupabaseClient = () => mockClient;

export const supabase = mockClient;

export const debugAuthSession = async () => {
  return {
    session: null,
    error: null,
  };
};
