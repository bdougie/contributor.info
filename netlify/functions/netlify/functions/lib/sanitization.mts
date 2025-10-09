/**
 * Sanitization utilities for API inputs
 * Provides secure string escaping for database queries
 */

/**
 * Sanitizes a search string for use in SQL LIKE/ILIKE queries
 * Properly escapes special characters to prevent SQL injection
 *
 * @param input - The raw search string from user input
 * @returns Sanitized string safe for use in SQL queries
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Order matters: escape backslashes first, then other special characters
  return input
    .replace(/\\/g, '\\\\') // Escape backslashes (must be first)
    .replace(/[%_]/g, '\\$&') // Escape SQL wildcards with backslash
    .replace(/'/g, "''") // Escape single quotes (SQL standard)
    .replace(/"/g, '""') // Escape double quotes
    .replace(/[,;]/g, '\\$&'); // Escape delimiters
}

/**
 * Sanitizes a string for use in PostgreSQL array operations
 *
 * @param input - The raw string from user input
 * @returns Sanitized string safe for array operations
 */
export function sanitizeArrayInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/'/g, "''") // Escape single quotes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/[{}]/g, '\\$&'); // Escape array delimiters
}

/**
 * Validates and sanitizes pagination parameters
 *
 * @param page - The page number from query params
 * @param limit - The limit from query params
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Safe pagination parameters
 */
export function sanitizePaginationParams(
  page: string | null,
  limit: string | null,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const safePage = Math.max(1, parseInt(page || '1') || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit || '10') || 10));
  const offset = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    offset,
  };
}

/**
 * Sanitizes a UUID string
 *
 * @param uuid - The UUID string to validate
 * @returns The UUID if valid, null otherwise
 */
export function sanitizeUUID(uuid: string | null): string | null {
  if (!uuid) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(uuid)) {
    return uuid.toLowerCase();
  }

  return null;
}

/**
 * Sanitizes an enum value against allowed values
 *
 * @param value - The value to check
 * @param allowedValues - Array of allowed values
 * @param defaultValue - Default value if invalid
 * @returns The value if valid, defaultValue otherwise
 */
export function sanitizeEnum<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
  defaultValue: T | null = null
): T | null {
  if (!value) return defaultValue;

  if (allowedValues.includes(value as T)) {
    return value as T;
  }

  return defaultValue;
}
