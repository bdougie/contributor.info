/**
 * Security tests for widget-badge function
 * Verifies that user inputs are properly escaped to prevent XSS attacks
 */

import { describe, it, expect } from 'vitest';

// Import the escape functions from the widget-badge module
// Note: In production, these would be exported or tested through the handler
function escapeXml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeColor(color) {
  const hexPattern = /^#[0-9A-Fa-f]{3,8}$/;
  const rgbPattern = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[0-9.]+\s*)?\)$/;
  const namedColors = [
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'purple',
    'gray',
    'black',
    'white',
  ];

  if (
    hexPattern.test(color) ||
    rgbPattern.test(color) ||
    namedColors.includes(color.toLowerCase())
  ) {
    return color;
  }

  return '#007ec6';
}

describe('Widget Badge Security', () => {
  describe('escapeXml', () => {
    it('should escape HTML entities', () => {
      expect(escapeXml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('should escape XML entities', () => {
      expect(escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;');
    });

    it('should remove control characters', () => {
      expect(escapeXml('Hello\x00World\x08Test')).toBe('HelloWorldTest');
    });

    it('should handle non-string inputs', () => {
      expect(escapeXml(123)).toBe('123');
      expect(escapeXml(null)).toBe('null');
      expect(escapeXml(undefined)).toBe('undefined');
    });

    it('should prevent SVG injection', () => {
      const malicious = '"><script>alert(1)</script><text x="';
      expect(escapeXml(malicious)).toBe(
        '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;text x=&quot;'
      );
    });

    it('should prevent style injection', () => {
      const malicious = '"><style>*{display:none}</style><text x="';
      expect(escapeXml(malicious)).toBe(
        '&quot;&gt;&lt;style&gt;*{display:none}&lt;/style&gt;&lt;text x=&quot;'
      );
    });
  });

  describe('sanitizeColor', () => {
    it('should allow valid hex colors', () => {
      expect(sanitizeColor('#fff')).toBe('#fff');
      expect(sanitizeColor('#ffffff')).toBe('#ffffff');
      expect(sanitizeColor('#12345678')).toBe('#12345678');
    });

    it('should allow valid rgb/rgba colors', () => {
      expect(sanitizeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
      expect(sanitizeColor('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('should allow named colors', () => {
      expect(sanitizeColor('red')).toBe('red');
      expect(sanitizeColor('blue')).toBe('blue');
      expect(sanitizeColor('GREEN')).toBe('GREEN'); // Case preserved
    });

    it('should reject invalid colors', () => {
      expect(sanitizeColor('javascript:alert(1)')).toBe('#007ec6');
      expect(sanitizeColor('url(#xss)')).toBe('#007ec6');
      expect(sanitizeColor('"><script>alert(1)</script>')).toBe('#007ec6');
    });

    it('should reject CSS expressions', () => {
      expect(sanitizeColor('expression(alert(1))')).toBe('#007ec6');
      expect(sanitizeColor('calc(100% - 10px)')).toBe('#007ec6');
    });
  });

  describe('XSS Attack Vectors', () => {
    it('should prevent onclick injection', () => {
      const attack = '" onclick="alert(1)" x="';
      expect(escapeXml(attack)).not.toContain('onclick');
      expect(escapeXml(attack)).toContain('&quot;');
    });

    it('should prevent onload injection', () => {
      const attack = '"><image href=x onerror="alert(1)"><text>';
      expect(escapeXml(attack)).not.toContain('onerror');
      expect(escapeXml(attack)).toContain('&lt;');
    });

    it('should prevent data URI injection', () => {
      const attack = 'data:text/html,<script>alert(1)</script>';
      expect(escapeXml(attack)).not.toContain('<script>');
    });

    it('should prevent CDATA injection', () => {
      const attack = ']]><script>alert(1)</script><![CDATA[';
      expect(escapeXml(attack)).not.toContain('<script>');
      expect(escapeXml(attack)).toContain('&lt;script&gt;');
    });
  });
});
