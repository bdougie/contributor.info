/**
 * API-related constants used throughout the application
 */

// Pagination and limits
export const API_LIMITS = {
  MAX_BATCH_SIZE: 100,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 5,
  DEFAULT_OFFSET: 0,
  MAX_RETRIES: 3,
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// GitHub API specific
export const GITHUB_API = {
  MAX_PER_PAGE: 100,
  DEFAULT_PER_PAGE: 30,
  MAX_SEARCH_RESULTS: 1000,
  RATE_LIMIT_THRESHOLD: 100,
  GRAPHQL_MAX_NODES: 100,
  MAX_REPO_TOPICS: 20,
} as const;

// Supabase specific
export const SUPABASE_LIMITS = {
  MAX_ROW_LIMIT: 1000,
  DEFAULT_ROW_LIMIT: 100,
  BATCH_INSERT_SIZE: 500,
  MAX_RPC_TIMEOUT: 60000, // 60 seconds
  DEFAULT_RPC_TIMEOUT: 30000, // 30 seconds
} as const;

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Query parameters
export const QUERY_PARAMS = {
  DEFAULT_SORT: 'created_at',
  DEFAULT_ORDER: 'desc',
  DEFAULT_FILTER: 'all',
} as const;

// API endpoints base paths
export const API_PATHS = {
  GITHUB_BASE: 'https://api.github.com',
  GITHUB_RAW: 'https://raw.githubusercontent.com',
  GITHUB_WEB: 'https://github.com',
} as const;

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
  HTML: 'text/html',
} as const;

// Headers
export const DEFAULT_HEADERS = {
  'Content-Type': CONTENT_TYPES.JSON,
  'Accept': CONTENT_TYPES.JSON,
} as const;

// WebSocket events
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  MESSAGE: 'message',
  RECONNECT: 'reconnect',
} as const;

// Response sizes
export const RESPONSE_SIZE = {
  MAX_JSON_SIZE_MB: 10,
  MAX_IMAGE_SIZE_MB: 5,
  MAX_FILE_SIZE_MB: 100,
  CHUNK_SIZE_BYTES: 1024 * 1024, // 1MB chunks
} as const;