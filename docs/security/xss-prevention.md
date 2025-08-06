# XSS Prevention and Component Security

## Overview

This document outlines XSS prevention measures and secure coding practices implemented in contributor.info components, with specific focus on the security improvements made to the `LastUpdated` component.

## Purpose

Component security documentation helps developers:
- **Prevent XSS vulnerabilities** - Eliminate dangerous patterns that allow script injection
- **Implement secure DOM manipulation** - Use safe React patterns for dynamic content
- **Validate user inputs** - Apply proper sanitization and validation
- **Follow security best practices** - Adopt industry-standard secure coding practices

## XSS Vulnerability Prevention

### 1. Elimination of `dangerouslySetInnerHTML`

**Problem**: Components using `dangerouslySetInnerHTML` create potential XSS attack vectors, especially when injecting structured data.

**Solution**: Replace with secure React ref approach using safe DOM APIs.

```tsx
// ❌ Vulnerable pattern
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(structuredData)
  }}
/>

// ✅ Secure pattern
<script
  type="application/ld+json"
  suppressHydrationWarning
  ref={(el) => {
    if (el) {
      el.textContent = JSON.stringify(structuredData);
    }
  }}
/>
```

### 2. Input Validation and Sanitization

**Security Measures**:
- String sanitization using existing validation utilities
- Detection of suspicious patterns (script tags, event handlers, etc.)
- Date range validation to prevent unreasonable timestamps
- Multiple layers of validation with appropriate error handling

```typescript
// Example validation pattern
function validateTimestamp(timestamp: string): boolean {
  // Sanitize input
  const sanitized = sanitizeString(timestamp);
  
  // Check for malicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onclick=/i,
    /onerror=/i,
    /onload=/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
    console.warn('🚨 SECURITY: Suspicious pattern detected in timestamp');
    return false;
  }
  
  // Validate date range
  const date = new Date(sanitized);
  const hundredYearsAgo = new Date();
  hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
  
  const tenYearsFromNow = new Date();
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);
  
  return date >= hundredYearsAgo && date <= tenYearsFromNow;
}
```

## Security Features Implemented

### LastUpdated Component Security

1. **Input Sanitization**: All string inputs are sanitized using `sanitizeString()` utility
2. **Pattern Detection**: Suspicious patterns are detected and rejected
3. **Date Range Validation**: Prevents unreasonable timestamps that could indicate malicious input
4. **Safe DOM Manipulation**: Eliminated `dangerouslySetInnerHTML` in favor of safe DOM APIs
5. **Comprehensive Logging**: Security-related rejections are logged with appropriate warnings

### Common XSS Attack Vectors

The component now detects and prevents:
- `<script>` tag injection
- `javascript:` protocol usage
- Event handler injection (`onclick=`, `onerror=`, etc.)
- Data URI with script content
- HTML entity-encoded malicious patterns

## Implementation Guidelines

### Secure Component Patterns

#### 1. Safe Structured Data Injection
```tsx
// Use refs with textContent for JSON-LD
const structuredDataRef = useRef<HTMLScriptElement>(null);

useEffect(() => {
  if (structuredDataRef.current) {
    structuredDataRef.current.textContent = JSON.stringify(structuredData);
  }
}, [structuredData]);

return (
  <script
    type="application/ld+json"
    ref={structuredDataRef}
    suppressHydrationWarning
  />
);
```

#### 2. Input Validation Middleware
```typescript
function useSecureInput<T>(
  input: T,
  validator: (input: T) => boolean,
  sanitizer?: (input: T) => T
): T | null {
  return useMemo(() => {
    const sanitized = sanitizer ? sanitizer(input) : input;
    return validator(sanitized) ? sanitized : null;
  }, [input, validator, sanitizer]);
}
```

#### 3. Security-First Error Handling
```typescript
function handleSecurityError(error: string, context: string) {
  console.warn(`🚨 SECURITY (${context}): ${error}`);
  // Log to security monitoring system if available
  // Return safe fallback value
}
```

## Testing Security Measures

### Test Cases for XSS Prevention

```typescript
describe('XSS Prevention', () => {
  it('should reject script tag injection', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    expect(validateTimestamp(maliciousInput)).toBe(false);
  });
  
  it('should reject javascript protocol', () => {
    const maliciousInput = 'javascript:alert("xss")';
    expect(validateTimestamp(maliciousInput)).toBe(false);
  });
  
  it('should reject event handlers', () => {
    const maliciousInput = 'onclick=alert("xss")';
    expect(validateTimestamp(maliciousInput)).toBe(false);
  });
  
  it('should accept valid timestamps', () => {
    const validInput = '2024-01-15T10:00:00.000Z';
    expect(validateTimestamp(validInput)).toBe(true);
  });
});
```

## Security Checklist

When implementing new components:

- [ ] **No `dangerouslySetInnerHTML`** - Use safe DOM manipulation instead
- [ ] **Input validation** - Validate all user inputs and external data
- [ ] **Pattern detection** - Check for suspicious content patterns
- [ ] **Safe rendering** - Use React's built-in XSS protection
- [ ] **Error handling** - Log security events appropriately
- [ ] **Testing** - Include security-focused test cases

## Files Modified

The following files have been updated with security improvements:

- **`src/components/ui/last-updated.tsx`** - Main security improvements
- **`src/components/ui/__tests__/last-updated.test.tsx`** - Updated tests for security features

## Common Security Anti-Patterns

### ❌ Dangerous Patterns to Avoid

```tsx
// Never bypass React's XSS protection
<div dangerouslySetInnerHTML={{__html: userInput}} />

// Don't trust external data without validation  
<script>{`window.data = ${JSON.stringify(externalData)}`}</script>

// Avoid dynamic script generation
eval(`var data = ${userInput}`);
```

### ✅ Secure Alternatives

```tsx
// Use textContent for script injection
scriptRef.current.textContent = JSON.stringify(data);

// Validate external data
const safeData = validateAndSanitize(externalData);

// Use proper data attributes
<div data-value={JSON.stringify(validatedData)} />
```

## Compliance Standards

These security measures align with:

- **OWASP Top 10** - XSS prevention guidelines
- **React Security Best Practices** - Component security patterns
- **CSP (Content Security Policy)** - Safe script execution policies
- **Modern Security Standards** - Industry-standard secure coding practices

## Security Resources

### Internal Resources
- [Environment Variables Security](./environment-variables.md) - Secure handling of secrets
- [Security Overview](./README.md) - Complete security documentation

### External Resources
- [OWASP XSS Prevention](https://owasp.org/www-community/xss-filter-evasion-cheatsheet)
- [React Security Best Practices](https://react.dev/reference/react-dom/components/common#applying-css-styles)
- [CSP Guidelines](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Secure Coding Standards](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

## Recommendations for Future Development

1. **Code Review Process** - All uses of `dangerouslySetInnerHTML` must be security reviewed
2. **Input Validation Library** - Continue expanding the validation utility functions
3. **Security Testing** - Include security-focused test cases for all components handling external data
4. **CSP Implementation** - Consider implementing Content Security Policy headers
5. **Automated Security Scanning** - Integrate tools to detect dangerous patterns in code

---

**Security is a shared responsibility.** When working with user input or external data, always prioritize security over convenience and seek security review when in doubt.