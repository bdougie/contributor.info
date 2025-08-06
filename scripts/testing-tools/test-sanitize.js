// Quick test to verify sanitizeString behavior
import { sanitizeString } from './src/lib/validation/validation-utils.ts';

console.log('Testing sanitizeString:');
console.log('invalid-date:', sanitizeString('invalid-date'));
console.log('<script>alert(1)</script>:', sanitizeString('<script>alert(1)</script>'));
console.log('javascript:alert(1):', sanitizeString('javascript:alert(1)'));
console.log('2040-01-01:', sanitizeString('2040-01-01'));