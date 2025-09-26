// Test if console.warn mock is working
import { vi } from 'vitest';

// Test 1: Direct console.warn
console.warn('Direct call test');

// Test 2: Mock and call
const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
console.warn('Mocked call test');
console.log('Mock calls:', mockWarn.mock.calls);

// Test 3: Restore and call
mockWarn.mockRestore();
console.warn('Restored call test');
