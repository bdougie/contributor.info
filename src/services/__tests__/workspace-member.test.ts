import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple email validation helper (extracted for pure function testing)
export function isValidEmail(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

// Simple role mapping helper (pure function)
export function mapWorkspaceRole(role: string): string {
  if (role === 'owner' || role === 'maintainer') {
    return 'admin';
  } else if (role === 'contributor') {
    return 'viewer';
  }
  return 'viewer';
}

// Temporary ID generator for UI (pure function)
export function generateTempId(invitationId: string, type: 'user' | 'invite'): string {
  return type === 'user' ? `pending-user-${invitationId}` : `pending-invite-${invitationId}`;
}

describe('Workspace Member Management - Pure Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Validation', () => {
    it('should reject invalid email formats', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@')).toBe(false);
      expect(isValidEmail('@missing.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
      expect(isValidEmail('double@@email.com')).toBe(false);
    });

    it('should accept valid RFC 5322 compliant emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('user_name@example-domain.org')).toBe(true);
      expect(isValidEmail('123@example.com')).toBe(true);
    });
  });

  describe('Role Mapping', () => {
    it('should map owner to admin', () => {
      expect(mapWorkspaceRole('owner')).toBe('admin');
    });

    it('should map maintainer to admin', () => {
      expect(mapWorkspaceRole('maintainer')).toBe('admin');
    });

    it('should map contributor to viewer', () => {
      expect(mapWorkspaceRole('contributor')).toBe('viewer');
    });

    it('should default unknown roles to viewer', () => {
      expect(mapWorkspaceRole('unknown')).toBe('viewer');
      expect(mapWorkspaceRole('')).toBe('viewer');
    });
  });

  describe('Temporary ID Generation', () => {
    it('should generate user temp ID with correct prefix', () => {
      const result = generateTempId('inv-123', 'user');
      expect(result).toBe('pending-user-inv-123');
    });

    it('should generate invite temp ID with correct prefix', () => {
      const result = generateTempId('inv-456', 'invite');
      expect(result).toBe('pending-invite-inv-456');
    });

    it('should handle empty invitation ID', () => {
      expect(generateTempId('', 'user')).toBe('pending-user-');
      expect(generateTempId('', 'invite')).toBe('pending-invite-');
    });
  });
});
