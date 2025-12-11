// Types for Repository Sync S3 Function

export interface SyncRequest {
  owner: string;
  name: string;
  fullSync?: boolean;
  daysLimit?: number;
  prLimit?: number;
  resumeFrom?: string; // Cursor for resuming partial syncs
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    type?: string;
  };
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
}

export interface FileSystem {
  writeTextFile(path: string, content: string, options?: { append?: boolean }): Promise<void>;
  readTextFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
}

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

// Minimal Supabase Client Interface for Dependency Injection
export interface SupabaseClientLike {
  from(table: string): SupabaseQueryBuilderLike;
}

export interface SupabaseQueryBuilderLike {
  select(columns?: string): SupabaseFilterBuilderLike;
  upsert(value: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): SupabaseFilterBuilderLike;
  update(value: unknown): SupabaseFilterBuilderLike;
  delete(): SupabaseFilterBuilderLike;
}

export interface SupabaseFilterBuilderLike {
  eq(column: string, value: unknown): SupabaseFilterBuilderLike;
  single(): Promise<{ data: any; error: any }>;
  maybeSingle(): Promise<{ data: any; error: any }>;
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

export interface SyncDependencies {
  supabase: SupabaseClientLike;
  fileSystem: FileSystem;
  logger: Logger;
  githubToken: string;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  ensureContributor: (supabase: SupabaseClientLike, user: any) => Promise<string | null>;
  env: {
    get(key: string): string | undefined;
  };
}
