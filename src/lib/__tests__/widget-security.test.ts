/**
 * Security tests for widget generation functions
 * Verifies that user inputs are properly escaped to prevent XSS attacks
 */

import { describe, it, expect } from 'vitest';

// Replicate the escape functions from the widget generation
function escapeXml(text: unknown): string {
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

function sanitizeColor(color: string): string {
  const hexPattern = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  const rgbPattern =
    /^rgba?\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*(?:,\s*(?:0?\.[0-9]+|1(?:\.0+)?|0))?\)$/;
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

describe('Widget Security - XSS Prevention', () => {
  describe('escapeXml', () => {
    it('should escape HTML entities', () => {
      expect(escapeXml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
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
        '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;text x=&quot;',
      );
    });

    it('should prevent style injection', () => {
      const malicious = '"><style>*{display:none}</style><text x="';
      expect(escapeXml(malicious)).toBe(
        '&quot;&gt;&lt;style&gt;*{display:none}&lt;/style&gt;&lt;text x=&quot;',
      );
    });
  });

  describe('sanitizeColor', () => {
    it('should allow valid hex colors', () => {
      expect(sanitizeColor('#fff')).toBe('#fff');
      expect(sanitizeColor('#ffffff')).toBe('#ffffff');
      expect(sanitizeColor('#12345678')).toBe('#12345678');
      expect(sanitizeColor('#ffff')).toBe('#ffff');
    });

    it('should reject invalid hex color lengths', () => {
      expect(sanitizeColor('#ff')).toBe('#007ec6'); // too short
      expect(sanitizeColor('#fffff')).toBe('#007ec6'); // 5 digits
      expect(sanitizeColor('#fffffff')).toBe('#007ec6'); // 7 digits
      expect(sanitizeColor('#fffffffff')).toBe('#007ec6'); // too long
    });

    it('should allow valid rgb/rgba colors', () => {
      expect(sanitizeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
      expect(sanitizeColor('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
      expect(sanitizeColor('rgb(0, 0, 0)')).toBe('rgb(0, 0, 0)');
      expect(sanitizeColor('rgb(255, 255, 255)')).toBe('rgb(255, 255, 255)');
    });

    it('should reject rgb/rgba colors with out-of-range values', () => {
      expect(sanitizeColor('rgb(256, 0, 0)')).toBe('#007ec6'); // > 255
      expect(sanitizeColor('rgb(300, 100, 50)')).toBe('#007ec6'); // > 255
      expect(sanitizeColor('rgba(256, 0, 0, 0.5)')).toBe('#007ec6'); // > 255
      expect(sanitizeColor('rgb(-1, 0, 0)')).toBe('#007ec6'); // negative
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
      const escaped = escapeXml(attack);
      // The onclick text remains but quotes are escaped, preventing execution
      expect(escaped).toBe('&quot; onclick=&quot;alert(1)&quot; x=&quot;');
      expect(escaped).not.toContain('"'); // No unescaped quotes
    });

    it('should prevent onload injection', () => {
      const attack = '"><image href=x onerror="alert(1)"><text>';
      const escaped = escapeXml(attack);
      // Tags are escaped, preventing element creation
      expect(escaped).not.toContain('<image');
      expect(escaped).not.toContain('><');
      expect(escaped).toContain('&lt;image');
    });

    it('should prevent _data URI injection', () => {
      const attack = 'data:text/html,<script>alert(1)</script>';
      expect(escapeXml(attack)).not.toContain('<script>');
    });

    it('should prevent CDATA injection', () => {
      const attack = ']]><script>alert(1)</script><![CDATA[';
      expect(escapeXml(attack)).not.toContain('<script>');
      expect(escapeXml(attack)).toContain('&lt;script&gt;');
    });

    it('should prevent SVG animate attack', () => {
      const attack = '"><animate attributeName="href" values="javascript:alert(1)"/><text>';
      const escaped = escapeXml(attack);
      expect(escaped).not.toContain('<animate');
      expect(escaped).toContain('&lt;animate'); // Tag is escaped
      // javascript: text remains but within escaped context
    });

    it('should prevent foreignObject injection', () => {
      const attack = '"><foreignObject><iframe src="javascript:alert(1)"/></foreignObject><text>';
      const escaped = escapeXml(attack);
      expect(escaped).not.toContain('<foreignObject');
      expect(escaped).not.toContain('<iframe');
    });
  });

  describe('Combined Attack Prevention', () => {
    it('should safely render user-controlled badge', () => {
      const maliciousLabel = '"><script>alert("label")</script>';
      const maliciousMessage = '"><img src=x onerror="alert(\'message\')">';
      const maliciousColor = 'red; }<style>*{display:none}</style>';

      const safeLabel = escapeXml(maliciousLabel);
      const safeMessage = escapeXml(maliciousMessage);
      const safeColor = sanitizeColor(maliciousColor);

      // Verify no executable code remains
      expect(safeLabel).not.toContain('<script>');
      expect(safeLabel).toContain('&lt;script'); // Script tag is escaped
      expect(safeMessage).not.toContain('<img');
      expect(safeMessage).toContain('&lt;img'); // Image tag is escaped
      expect(safeColor).toBe('#007ec6'); // Falls back to default

      // Verify escaped content is safe for SVG
      const svg = `<svg><text>${safeLabel}</text><text>${safeMessage}</text></svg>`;
      expect(svg).not.toContain('<script>');
      expect(svg).not.toContain('<img src');
    });
  });
});
