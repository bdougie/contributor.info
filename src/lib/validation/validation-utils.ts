/**
 * Validation utilities and helpers for data transformation and validation
 * Provides common validation patterns and error handling for database operations
 */

import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

// =====================================================
// VALIDATION RESULT TYPES
// =====================================================

/**
 * Standard validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationIssue[];
}

/**
 * Detailed validation error type
 */
export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
  received?: unknown;
}

/**
 * Bulk validation result type
 */
export interface BulkValidationResult<T> {
  success: boolean;
  validItems: T[];
  invalidItems: Array<{
    index: number;
    item: unknown;
    errors: ValidationIssue[];
  }>;
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
}

// =====================================================
// CORE VALIDATION FUNCTIONS
// =====================================================

/**
 * Validates data against a Zod schema and returns a standardized result
 */
export function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors = formatZodErrors(error);
      return {
        success: false,
        error: context
          ? `Validation failed for ${context}: ${validationErrors[0]?.message || 'Unknown error'}`
          : `Validation failed: ${validationErrors[0]?.message || 'Unknown error'}`,
        errors: validationErrors,
      };
    }

    return {
      success: false,
      error: context
        ? `Unexpected validation error for ${context}: ${String(error)}`
        : `Unexpected validation error: ${String(error)}`,
    };
  }
}

/**
 * Validates data with safe parsing (non-throwing)
 */
export function safeValidateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ZodError } {
  return schema.safeParse(data);
}

/**
 * Validates an array of items and returns detailed results
 */
export function validateBulkData<T>(
  schema: ZodSchema<T>,
  items: unknown[],
  context?: string
): BulkValidationResult<T> {
  const validItems: T[] = [];
  const invalidItems: Array<{
    index: number;
    item: unknown;
    errors: ValidationIssue[];
  }> = [];

  items.forEach((item, index) => {
    const result = validateData(schema, item, `${context} item ${index}`);

    if (result.success && result.data) {
      validItems.push(result.data);
    } else {
      invalidItems.push({
        index,
        item,
        errors: result.errors || [
          {
            field: 'unknown',
            message: result.error || 'Unknown validation error',
            code: 'VALIDATION_ERROR',
            received: item,
          },
        ],
      });
    }
  });

  return {
    success: invalidItems.length === 0,
    validItems,
    invalidItems,
    totalProcessed: items.length,
    totalValid: validItems.length,
    totalInvalid: invalidItems.length,
  };
}

/**
 * Transforms and validates data in a single operation
 */
export function transformAndValidate<TInput, TOutput>(
  inputSchema: ZodSchema<TInput>,
  outputSchema: ZodSchema<TOutput>,
  transformer: (input: TInput) => TOutput,
  data: unknown,
  context?: string
): ValidationResult<TOutput> {
  // First validate input
  const inputResult = validateData(inputSchema, data, `${context} input`);
  if (!inputResult.success || !inputResult.data) {
    return {
      success: false,
      error: inputResult.error,
      errors: inputResult.errors,
    };
  }

  // Transform data
  try {
    const transformedData = transformer(inputResult.data);

    // Validate output
    return validateData(outputSchema, transformedData, `${context} output`);
  } catch (error) {
    return {
      success: false,
      error: `Transformation error for ${context}: ${String(error)}`,
    };
  }
}

// =====================================================
// ERROR FORMATTING UTILITIES
// =====================================================

/**
 * Formats Zod validation errors into a standardized format
 */
export function formatZodErrors(zodError: ZodError): ValidationIssue[] {
  return zodError.errors.map((error) => ({
    field: error.path.join('.') || 'root',
    message: error.message,
    code: error.code,
    received: (error as any).received || undefined,
  }));
}

/**
 * Creates a human-readable error message from validation errors
 */
export function createErrorMessage(errors: ValidationIssue[]): string {
  if (errors.length === 0) {
    return 'Unknown validation error';
  }

  if (errors.length === 1) {
    const error = errors[0];
    return `${error.field}: ${error.message}`;
  }

  return `Multiple validation errors: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`;
}

/**
 * Groups validation errors by field for easier handling
 */
export function groupErrorsByField(errors: ValidationIssue[]): Record<string, ValidationIssue[]> {
  return errors.reduce(
    (acc, error) => {
      const field = error.field;
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(error);
      return acc;
    },
    {} as Record<string, ValidationIssue[]>
  );
}

// =====================================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =====================================================

/**
 * Creates a validation middleware function for use in data pipelines
 */
export function createValidationMiddleware<T>(schema: ZodSchema<T>, context?: string) {
  return (data: unknown): T => {
    const result = validateData(schema, data, context);

    if (!result.success || !result.data) {
      throw new ValidationError(result.error || 'Validation failed', result.errors || []);
    }

    return result.data;
  };
}

/**
 * Custom ValidationError class for better error handling
 */
export class ValidationError extends Error {
  public readonly validationErrors: ValidationIssue[];

  constructor(message: string, errors: ValidationIssue[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.validationErrors = errors;
  }
}

// =====================================================
// DATA SANITIZATION UTILITIES
// =====================================================

/**
 * Sanitizes string input by trimming whitespace and handling null/undefined
 */
export function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return String(value).trim() || null;
}

/**
 * Sanitizes numeric input and ensures it's within valid range
 */
export function sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return null;
  }

  if (max !== undefined && num > max) {
    return null;
  }

  return num;
}

/**
 * Sanitizes array input and filters out invalid items
 */
export function sanitizeArray<T>(value: unknown, itemValidator?: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (!itemValidator) {
    return value as T[];
  }

  return value.map(itemValidator).filter((item): item is T => item !== null);
}

/**
 * Sanitizes URL input and validates format
 */
export function sanitizeUrl(value: unknown): string | null {
  const sanitized = sanitizeString(value);

  if (!sanitized) {
    return null;
  }

  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    return null;
  }
}

/**
 * Sanitizes email input and validates format
 */
export function sanitizeEmail(value: unknown): string | null {
  const sanitized = sanitizeString(value);

  if (!sanitized) {
    return null;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : null;
}

// =====================================================
// GITHUB-SPECIFIC VALIDATION UTILITIES
// =====================================================

/**
 * Validates GitHub username format
 */
export function isValidGitHubUsername(username: string): boolean {
  if (!username || username.length === 0 || username.length > 39) {
    return false;
  }

  // GitHub usernames can contain alphanumeric characters and hyphens
  // but cannot start or end with hyphens
  const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return usernameRegex.test(username);
}

/**
 * Validates repository full name format (owner/repo)
 */
export function isValidRepositoryFullName(fullName: string): boolean {
  if (!fullName) {
    return false;
  }

  const parts = fullName.split('/');
  if (parts.length !== 2) {
    return false;
  }

  const [owner, repo] = parts;
  return isValidGitHubUsername(owner) && isValidRepositoryName(repo);
}

/**
 * Validates GitHub repository name format
 */
export function isValidRepositoryName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 100) {
    return false;
  }

  // Repository names can contain alphanumeric characters, periods, hyphens, and underscores
  const repoRegex = /^[a-zA-Z0-9._-]+$/;
  return repoRegex.test(name);
}

/**
 * Validates GitHub ID format (positive integer)
 */
export function isValidGitHubId(id: unknown): boolean {
  const num = Number(id);
  return Number.isInteger(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
}

// =====================================================
// PERFORMANCE UTILITIES
// =====================================================

/**
 * Creates a memoized validator for better performance with repeated validation
 */
export function createMemoizedValidator<T>(schema: ZodSchema<T>, maxCacheSize: number = 1000) {
  const cache = new Map<string, ValidationResult<T>>();

  return (data: unknown, context?: string): ValidationResult<T> => {
    const cacheKey = JSON.stringify(data);

    // Check cache first
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    // Validate data
    const result = validateData(schema, data, context);

    // Add to cache (with size limit)
    if (cache.size >= maxCacheSize) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(cacheKey, result);
    return result;
  };
}

/**
 * Debounced validation for user input
 */
export function createDebouncedValidator<T>(schema: ZodSchema<T>, delay: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (
    data: unknown,
    callback: (result: ValidationResult<T>) => void,
    context?: string
  ): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const result = validateData(schema, data, context);
      callback(result);
    }, delay);
  };
}

// =====================================================
// VALIDATION STATISTICS
// =====================================================

/**
 * Validation statistics tracker
 */
export class ValidationStats {
  private stats = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    errorsByType: {} as Record<string, number>,
    averageValidationTime: 0,
  };

  public recordValidation(success: boolean, duration: number, errorType?: string): void {
    this.stats.totalValidations++;

    if (success) {
      this.stats.successfulValidations++;
    } else {
      this.stats.failedValidations++;

      if (errorType) {
        this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
      }
    }

    // Update average validation time
    this.stats.averageValidationTime =
      (this.stats.averageValidationTime * (this.stats.totalValidations - 1) + duration) /
      this.stats.totalValidations;
  }

  public getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.totalValidations > 0
          ? this.stats.successfulValidations / this.stats.totalValidations
          : 0,
    };
  }

  public reset(): void {
    this.stats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      errorsByType: {},
      averageValidationTime: 0,
    };
  }
}

// Global validation stats instance
export const validationStats = new ValidationStats();
