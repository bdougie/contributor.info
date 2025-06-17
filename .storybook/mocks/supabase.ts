// Mock Supabase client for Storybook
// This prevents the need for real Supabase credentials in CI/testing environments

export const createSupabaseClient = () => {
  return {
    auth: {
      getSession: async () => ({ 
        data: { session: null }, 
        error: null 
      }),
      signInWithOAuth: async () => ({ 
        data: null, 
        error: null 
      }),
      signOut: async () => ({ 
        error: null 
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      })
    },
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null })
    })
  };
};

export const supabase = createSupabaseClient();

export const debugAuthSession = async () => {
  return { 
    session: null, 
    error: null 
  };
};