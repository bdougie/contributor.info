import { describe, it, expect } from 'vitest';
import {
  validateWorkspaceName,
  validateWorkspaceDescription,
  validateWorkspaceVisibility,
  validateWorkspaceSettings,
  validateCreateWorkspace,
  validateUpdateWorkspace,
  validateEmail,
  validateWorkspaceRole,
  validateAddRepository,
  validateInviteMember,
  formatValidationErrors,
} from '../workspace';

describe('Workspace Validation', () => {
  describe('validateWorkspaceName', () => {
    it('should accept valid workspace names', () => {
      const validNames = ['My Workspace', 'workspace-123', 'test_workspace', 'A', 'a'.repeat(100)];

      validNames.forEach((name) => {
        const result = validateWorkspaceName(name);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid workspace names', () => {
      const invalidCases = [
        { name: '', error: 'Name is required' },
        { name: null as unknown, error: 'Name is required' },
        { name: undefined as unknown, error: 'Name is required' },
        { name: 'a'.repeat(101), error: 'Name must be between 1 and 100 characters' },
        { name: 'workspace@#$%', error: 'Name contains invalid characters' },
        { name: 'workspace!', error: 'Name contains invalid characters' },
      ];

      invalidCases.forEach(({ name, error }) => {
        const result = validateWorkspaceName(name);
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.message.includes(error.split(' ').slice(0, 3).join(' '))),
        ).toBe(true);
      });
    });
  });

  describe('validateWorkspaceDescription', () => {
    it('should accept valid descriptions', () => {
      const validDescriptions = ['A simple description', '', null, undefined, 'a'.repeat(500)];

      validDescriptions.forEach((desc) => {
        const result = validateWorkspaceDescription(desc);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid descriptions', () => {
      const result1 = validateWorkspaceDescription('a'.repeat(501));
      expect(result1.valid).toBe(false);
      expect(result1.errors[0].message).toContain('500 characters');

      const result2 = validateWorkspaceDescription(123 as unknown);
      expect(result2.valid).toBe(false);
      expect(result2.errors[0].message).toContain('must be a string');
    });
  });

  describe('validateWorkspaceVisibility', () => {
    it('should accept valid visibility values', () => {
      expect(validateWorkspaceVisibility('public').valid).toBe(true);
      expect(validateWorkspaceVisibility('private').valid).toBe(true);
      expect(validateWorkspaceVisibility(undefined).valid).toBe(true);
    });

    it('should reject invalid visibility values', () => {
      const result = validateWorkspaceVisibility('internal' as unknown);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('public" or "private');
    });
  });

  describe('validateWorkspaceSettings', () => {
    it('should accept valid settings', () => {
      const validSettings = [
        undefined,
        null,
        {},
        { theme: 'dark' },
        { dashboard_layout: 'grid' },
        { default_time_range: '30d' },
        {
          custom_branding: {
            logo_url: 'https://example.com/logo.png',
            primary_color: '#FF5733',
          },
        },
        {
          theme: 'light',
          dashboard_layout: 'list',
          default_time_range: '90d',
        },
      ];

      validSettings.forEach((settings) => {
        const result = validateWorkspaceSettings(settings as unknown);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid settings', () => {
      const invalidCases = [
        {
          settings: { theme: 'invalid' },
          error: 'Invalid theme value',
        },
        {
          settings: { dashboard_layout: 'invalid' },
          error: 'Invalid dashboard layout',
        },
        {
          settings: { default_time_range: '60d' },
          error: 'Invalid default time range',
        },
        {
          settings: { custom_branding: { primary_color: 'red' } },
          error: 'valid hex color',
        },
        {
          settings: { custom_branding: { logo_url: 123 } },
          error: 'Logo URL must be a string',
        },
        {
          settings: 'not an object' as unknown,
          error: 'Settings must be an object',
        },
      ];

      invalidCases.forEach(({ settings, error }) => {
        const result = validateWorkspaceSettings(settings);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes(error))).toBe(true);
      });
    });
  });

  describe('validateCreateWorkspace', () => {
    it('should accept valid create workspace request', () => {
      const validRequest = {
        name: 'Test Workspace',
        description: 'A test workspace',
        visibility: 'public' as const,
        settings: {
          theme: 'dark' as const,
        },
      };

      const result = validateCreateWorkspace(validRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid create workspace request', () => {
      const invalidRequest = {
        name: '',
        description: 'a'.repeat(501),
        visibility: 'invalid' as unknown,
        settings: {
          theme: 'invalid' as unknown,
        },
      };

      const result = validateCreateWorkspace(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      expect(result.errors.some((e) => e.field === 'description')).toBe(true);
      expect(result.errors.some((e) => e.field === 'visibility')).toBe(true);
      expect(result.errors.some((e) => e.field === 'settings.theme')).toBe(true);
    });
  });

  describe('validateUpdateWorkspace', () => {
    it('should accept valid update workspace request', () => {
      const validUpdates = [
        {},
        { name: 'Updated Name' },
        { description: 'Updated description' },
        { visibility: 'private' as const },
        { settings: { theme: 'light' as const } },
        {
          name: 'New Name',
          description: 'New description',
          visibility: 'public' as const,
          settings: {},
        },
      ];

      validUpdates.forEach((update) => {
        const result = validateUpdateWorkspace(update);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid update workspace request', () => {
      const invalidRequest = {
        name: 'a'.repeat(101),
        visibility: 'internal' as unknown,
      };

      const result = validateUpdateWorkspace(invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      expect(result.errors.some((e) => e.field === 'visibility')).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org'];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        null as unknown,
        undefined as unknown,
      ];

      invalidEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateWorkspaceRole', () => {
    it('should accept valid roles', () => {
      const validRoles = ['admin', 'editor', 'viewer'];

      validRoles.forEach((role) => {
        const result = validateWorkspaceRole(role);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should accept owner role when allowed', () => {
      const result = validateWorkspaceRole('owner', true);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject owner role when not allowed', () => {
      const result = validateWorkspaceRole('owner', false);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('admin, editor, viewer');
    });

    it('should reject invalid roles', () => {
      const invalidRoles = ['', 'superadmin', 'guest', null, undefined];

      invalidRoles.forEach((role) => {
        const result = validateWorkspaceRole(role as unknown);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateAddRepository', () => {
    it('should accept valid add repository request', () => {
      const validRequests = [
        { repository_id: 'repo-123' },
        { repository_id: 'repo-123', notes: 'Important repo' },
        { repository_id: 'repo-123', tags: ['frontend', 'react'] },
        { repository_id: 'repo-123', is_pinned: true },
        {
          repository_id: 'repo-123',
          notes: 'Main repository',
          tags: ['production'],
          is_pinned: false,
        },
      ];

      validRequests.forEach((request) => {
        const result = validateAddRepository(request);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid add repository request', () => {
      const invalidCases = [
        {
          request: { repository_id: '' },
          error: 'Repository ID is required',
        },
        {
          request: { repository_id: null as unknown },
          error: 'Repository ID is required',
        },
        {
          request: { repository_id: 'repo', notes: 'a'.repeat(501) },
          error: '500 characters',
        },
        {
          request: { repository_id: 'repo', tags: 'not-array' as unknown },
          error: 'Tags must be an array',
        },
        {
          request: { repository_id: 'repo', tags: ['a'.repeat(51)] },
          error: '50 characters',
        },
        {
          request: { repository_id: 'repo', is_pinned: 'true' as unknown },
          error: 'must be a boolean',
        },
      ];

      invalidCases.forEach(({ request, error }) => {
        const result = validateAddRepository(request);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes(error))).toBe(true);
      });
    });
  });

  describe('validateInviteMember', () => {
    it('should accept valid invite member request', () => {
      const validRequests = [
        { email: 'user@example.com', role: 'viewer' as const },
        { email: 'admin@company.org', role: 'admin' as const },
        {
          email: 'user@example.com',
          role: 'editor' as const,
          message: 'Welcome to the team!',
        },
      ];

      validRequests.forEach((request) => {
        const result = validateInviteMember(request);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid invite member request', () => {
      const invalidCases = [
        {
          request: { email: 'invalid', role: 'viewer' as const },
          error: 'Invalid email',
        },
        {
          request: { email: 'user@example.com', role: 'owner' as const },
          error: 'admin, editor, viewer',
        },
        {
          request: {
            email: 'user@example.com',
            role: 'viewer' as const,
            message: 'a'.repeat(501),
          },
          error: '500 characters',
        },
      ];

      invalidCases.forEach(({ request, error }) => {
        const result = validateInviteMember(request);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes(error))).toBe(true);
      });
    });
  });

  describe('formatValidationErrors', () => {
    it('should format no errors correctly', () => {
      expect(formatValidationErrors([])).toBe('');
    });

    it('should format single error correctly', () => {
      const _ = [{ field: 'name', message: 'Name is required' }];
      expect(formatValidationErrors(errors)).toBe('Name is required');
    });

    it('should format multiple errors correctly', () => {
      const _ = [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email' },
      ];
      expect(formatValidationErrors(errors)).toBe(
        'Validation failed: name: Name is required, email: Invalid email',
      );
    });
  });
});
