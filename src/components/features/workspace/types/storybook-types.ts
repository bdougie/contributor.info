// Type definitions for Storybook stories and mock data

export interface WorkspaceFormData {
  name: string;
  description?: string;
  slug?: string;
  repositories?: string[];
}

export interface MockSupabaseAuth {
  onAuthStateChange: (callback: (event: string, session: MockSession | null) => void) => { unsubscribe: () => void };
  signIn?: () => Promise<{ user: MockUser | null; error: null }>;
  signOut?: () => Promise<{ error: null }>;
  signUp?: () => Promise<{ user: MockUser | null; error: null }>;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
  refresh_token?: string;
}

export interface MockUser {
  id: string;
  email: string;
  email_confirmed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MockSupabaseQuery {
  eq: (column: string, value: string | number | boolean) => MockSupabaseQuery;
  in: (column: string, values: Array<string | number>) => MockSupabaseQuery;
  single: () => MockSupabaseQuery;
  select: (columns?: string) => MockSupabaseQuery;
  order?: (column: string, options?: { ascending?: boolean }) => MockSupabaseQuery;
  limit?: (count: number) => MockSupabaseQuery;
}

export interface MockSupabaseResponse<T> {
  data: T | null;
  error: null | { message: string };
}

export interface MockSupabaseClient {
  auth: MockSupabaseAuth;
  from: (table: string) => {
    select: (columns?: string) => MockSupabaseQuery & Promise<MockSupabaseResponse<unknown[]>>;
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => MockSupabaseQuery & Promise<MockSupabaseResponse<unknown>>;
    update: (data: Record<string, unknown>) => MockSupabaseQuery & Promise<MockSupabaseResponse<unknown>>;
    delete: () => MockSupabaseQuery & Promise<MockSupabaseResponse<unknown>>;
  };
}

export interface MockWorkspaceService {
  addRepositoryToWorkspace: (
    workspaceId: string,
    data: { full_name: string; owner: string; repo: string },
    userId: string
  ) => Promise<{ data: unknown; error: null | { message: string } }>;
  checkPermissions?: (workspaceId: string, userId: string) => Promise<{
    canAdd: boolean;
    reason?: string;
    limit?: number;
    current?: number;
  }>;
}

export interface StorybookMockOptions {
  authenticated?: boolean;
  workspaceAtLimit?: boolean;
  hasRepositories?: boolean;
  customUser?: Partial<MockUser>;
  customRepositories?: Array<{ full_name: string; owner: string; repo: string }>;
}