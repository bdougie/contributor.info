/**
 * Database operation utilities with enhanced error handling
 * Provides consistent error handling and validation for Supabase operations
 */

import { sanitizeText } from './validation.js';

/**
 * Execute a Supabase upsert with proper error handling
 */
export async function safeUpsert(supabase, table, data, options, logger) {
  try {
    // Sanitize text fields
    const sanitizedData = sanitizeData(data);

    const { data: result, error } = await supabase.from(table).upsert(sanitizedData, options);

    if (error) {
      logger.error('Database upsert failed for %s: %s', table, error.message);

      // Check for specific error types
      if (error.code === '23505') {
        logger.error('Duplicate key violation in %s', table);
      } else if (error.code === '23503') {
        logger.error('Foreign key violation in %s', table);
      } else if (error.code === '42501') {
        logger.error('Permission denied for %s', table);
      }

      throw new Error(`Failed to upsert to ${table}: ${error.message}`);
    }

    return { success: true, data: result };
  } catch (error) {
    logger.error('Unexpected error in safeUpsert for %s: %s', table, error.message);
    throw error;
  }
}

/**
 * Execute a Supabase update with proper error handling
 */
export async function safeUpdate(supabase, table, updates, conditions, logger) {
  try {
    // Sanitize text fields
    const sanitizedUpdates = sanitizeData(updates);

    let query = supabase.from(table).update(sanitizedUpdates);

    // Apply conditions
    for (const [key, value] of Object.entries(conditions)) {
      query = query.eq(key, value);
    }

    const { data: result, error } = await query;

    if (error) {
      logger.error('Database update failed for %s: %s', table, error.message);
      throw new Error(`Failed to update ${table}: ${error.message}`);
    }

    return { success: true, data: result };
  } catch (error) {
    logger.error('Unexpected error in safeUpdate for %s: %s', table, error.message);
    throw error;
  }
}

/**
 * Execute a Supabase select with proper error handling
 */
export async function safeSelect(supabase, table, conditions, logger) {
  try {
    let query = supabase.from(table).select();

    // Apply conditions
    if (conditions) {
      for (const [key, value] of Object.entries(conditions)) {
        query = query.eq(key, value);
      }
    }

    const { data: result, error } = await query;

    if (error) {
      logger.error('Database select failed for %s: %s', table, error.message);
      throw new Error(`Failed to select from ${table}: ${error.message}`);
    }

    return { success: true, data: result };
  } catch (error) {
    logger.error('Unexpected error in safeSelect for %s: %s', table, error.message);
    throw error;
  }
}

/**
 * Sanitize data object for database insertion
 */
function sanitizeData(data) {
  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Sanitize string fields
      sanitized[key] = sanitizeText(value);
    } else if (value === undefined) {
      // Skip undefined values
      continue;
    } else {
      // Keep other types as-is
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if a record exists in the database
 */
export async function recordExists(supabase, table, conditions, logger) {
  try {
    const { data, success } = await safeSelect(supabase, table, conditions, logger);
    return success && data && data.length > 0;
  } catch (error) {
    logger.error('Error checking existence in %s: %s', table, error.message);
    return false;
  }
}
