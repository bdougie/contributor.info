// Environment variable helpers that work in both browser and Node.js contexts

// For Node.js environments (like Netlify Functions), just use process.env
// For browser environments, we'll rely on Vite's bundling to inline the values

export const VITE_GITHUB_TOKEN = typeof process !== 'undefined' ? process.env.VITE_GITHUB_TOKEN : undefined;
export const VITE_SUPABASE_URL = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined;
export const VITE_SUPABASE_ANON_KEY = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined;
export const VITE_INNGEST_EVENT_KEY = typeof process !== 'undefined' ? process.env.VITE_INNGEST_EVENT_KEY : undefined;
export const NODE_ENV = (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined) || 'production';