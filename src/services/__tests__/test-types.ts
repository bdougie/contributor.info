/**
 * Type definitions for Supabase mocks used in tests
 */

// Define mock response types
export interface MockSupabaseResponse<T = unknown> {
  data: T | null;
  error: Error | null;
  count?: number | null;
}

// Define mock query builder types
export interface MockQueryBuilder<T = unknown> {
  select: (query?: string) => MockQueryBuilder<T>;
  insert: (data: unknown) => MockQueryBuilder<T>;
  update: (data: unknown) => MockQueryBuilder<T>;
  delete: () => MockQueryBuilder<T>;
  eq: (column: string, value: unknown) => MockQueryBuilder<T> | Promise<MockSupabaseResponse<T>>;
  neq: (column: string, value: unknown) => MockQueryBuilder<T>;
  in: (column: string, values: unknown[]) => MockQueryBuilder<T>;
  is: (column: string, value: unknown) => MockQueryBuilder<T>;
  gte: (column: string, value: unknown) => MockQueryBuilder<T>;
  lte: (column: string, value: unknown) => MockQueryBuilder<T>;
  single: () => MockQueryBuilder<T>;
  maybeSingle: () => MockQueryBuilder<T> | Promise<MockSupabaseResponse<T>>;
  limit: (count: number) => MockQueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => MockQueryBuilder<T>;
}

// Thenable version of the mock query builder
export interface MockQueryBuilderThenable<T = unknown> extends MockQueryBuilder<T> {
  then: (resolve: (value: MockSupabaseResponse<T>) => void) => void;
}

// Helper function to create a mock query builder
export function createMockQueryBuilder<T = unknown>(
  response: MockSupabaseResponse<T>
): MockQueryBuilderThenable<T> {
  const builder: MockQueryBuilderThenable<T> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    is: () => builder,
    gte: () => builder,
    lte: () => builder,
    single: () => builder,
    maybeSingle: () => Promise.resolve(response),
    limit: () => builder,
    order: () => builder,
    then: (resolve: (value: MockSupabaseResponse<T>) => void) => {
      resolve(response);
    },
  };

  return builder;
}

// Type for the mocked supabase.from function
export type MockSupabaseFrom = (table: string) => MockQueryBuilder;

// Type for the mocked supabase.rpc function
export type MockSupabaseRpc = (
  functionName: string,
  params?: unknown
) => Promise<MockSupabaseResponse>;
