#!/usr/bin/env node

/**
 * Safe JSON writer for GitHub Actions
 * Ensures all strings are properly escaped to prevent JSON parsing errors
 */

const fs = require('fs');

function safeStringify(value) {
  if (typeof value === 'string') {
    // Remove or escape control characters
    return value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"') // Escape quotes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\t/g, '\\t'); // Escape tabs
  } else if (Array.isArray(value)) {
    return value.map(safeStringify);
  } else if (typeof value === 'object' && value !== null) {
    const result = {};
    for (const key in value) {
      result[key] = safeStringify(value[key]);
    }
    return result;
  }
  return value;
}

// Get data from environment variable or stdin
const inputData = process.env.JSON_DATA || '';
const outputFile = process.argv[2] || 'check-results.json';

try {
  const data = inputData ? JSON.parse(inputData) : {};
  const cleanedData = safeStringify(data);
  fs.writeFileSync(outputFile, JSON.stringify(cleanedData, null, 2));
  console.log(`Successfully wrote safe JSON to ${outputFile}`);
} catch (error) {
  console.error('Error processing JSON:', error.message);
  // Write a safe fallback
  fs.writeFileSync(outputFile, JSON.stringify({ error: 'Failed to process results' }, null, 2));
  process.exit(1);
}
