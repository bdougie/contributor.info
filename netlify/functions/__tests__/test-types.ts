import { vi } from 'vitest';

// Supabase mock types
export interface MockSupabaseResponse<T = unknown> {
  data: T | null;
  error: Error | null;
}

export interface MockSupabaseQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq?: ReturnType<typeof vi.fn>;
  order?: ReturnType<typeof vi.fn>;
  limit?: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
  single?: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
}

// Repository tracking types
export interface TrackedRepository {
  id: string;
  owner: string;
  name: string;
  is_active?: boolean;  // Optional since it might not be available
  tracking_status?: 'active' | 'inactive' | null;
}

// CODEOWNERS types
export interface CodeOwnersData {
  content: string;
  file_path: string;
  updated_at: string;
  repository_id: string;
}

// Contribution types
export interface Contribution {
  username: string;
  total_commits: number;
  total_prs: number;
  total_reviews: number;
  files_touched: string[];
  directories_touched: string[];
}

// Helper function to create a complete mock query builder chain
export function createMockQueryBuilder<T = unknown>(
  response: MockSupabaseResponse<T>
): MockSupabaseQueryBuilder {
  const mockMaybeSingle = vi.fn().mockResolvedValue(response);
  const mockSingle = vi.fn().mockResolvedValue(response);
  const mockLimit = vi.fn().mockReturnValue({
    maybeSingle: mockMaybeSingle,
    single: mockSingle
  });
  const mockOrder = vi.fn().mockReturnValue({
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle
  });
  const mockEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      order: mockOrder,
      limit: mockLimit
    }),
    neq: vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
      single: mockSingle
    }),
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle
  });
  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
    neq: vi.fn().mockReturnValue({
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle
    }),
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle
  });

  return {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle
  };
}

// Helper to create a mock Supabase client
export function createMockSupabaseClient<T = unknown>(
  response: MockSupabaseResponse<T>
): MockSupabaseClient {
  const queryBuilder = createMockQueryBuilder(response);
  const mockFrom = vi.fn().mockReturnValue(queryBuilder);

  return { from: mockFrom };
}