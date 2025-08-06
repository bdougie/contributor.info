// Test the actual logic flow
function sanitizeString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  
  return String(value).trim() || null;
}

function testValidateTimestamp(timestamp) {
  console.log(`\nTesting timestamp: "${timestamp}"`);
  
  let date;
  
  if (typeof timestamp === 'string') {
    const sanitized = sanitizeString(timestamp);
    console.log(`  Sanitized: "${sanitized}"`);
    
    if (!sanitized) {
      console.log(`  Result: null (sanitized is falsy)`);
      return null;
    }
    
    date = new Date(sanitized);
    console.log(`  Date object:`, date);
    console.log(`  isNaN(date.getTime()):`, isNaN(date.getTime()));
    
    if (isNaN(date.getTime())) {
      console.log(`  Result: null (invalid date)`);
      return null;
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<\w+/,
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/
    ];
    
    const hasPattern = suspiciousPatterns.some(pattern => pattern.test(sanitized));
    console.log(`  Has suspicious pattern:`, hasPattern);
    
    if (hasPattern) {
      console.log(`  Result: null (suspicious pattern)`);
      return null;
    }
  }
  
  // Check date range
  const now = new Date();
  const hundredYearsAgo = new Date(now.getFullYear() - 100, 0, 1);
  const tenYearsFromNow = new Date(now.getFullYear() + 10, 11, 31);
  
  console.log(`  Date range check:`, date < hundredYearsAgo || date > tenYearsFromNow);
  
  if (date < hundredYearsAgo || date > tenYearsFromNow) {
    console.log(`  Result: null (out of range)`);
    return null;
  }
  
  console.log(`  Result: valid date`);
  return date;
}

// Test cases from the failing tests
const testCases = [
  'invalid-date',
  '<script>alert("xss")</script>',
  '2050-01-01T00:00:00Z',
  'javascript:alert(1)',
  '2024-01-15T10:00:00Z' // valid one
];

testCases.forEach(tc => testValidateTimestamp(tc));