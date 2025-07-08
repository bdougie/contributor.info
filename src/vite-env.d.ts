/// <reference types="vite/client" />

// Handle both ESM and CommonJS environments
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_GITHUB_TOKEN?: string
      VITE_SUPABASE_URL?: string
      VITE_SUPABASE_ANON_KEY?: string
      VITE_INNGEST_EVENT_KEY?: string
      NODE_ENV?: string
    }
  }
}

interface ImportMetaEnv {
  readonly VITE_GITHUB_TOKEN?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_INNGEST_EVENT_KEY?: string
  readonly NODE_ENV?: string
}

interface ImportMeta {
  readonly env?: ImportMetaEnv
}