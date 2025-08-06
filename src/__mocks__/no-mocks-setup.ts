/**
 * No-mock setup - Only sets up absolutely essential test utilities
 * All tests requiring mocks should be skipped
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Only cleanup DOM after each test, no mocks
afterEach(() => {
  cleanup();
});