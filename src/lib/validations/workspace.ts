/**
 * Workspace Validation Schemas
 * Validation rules and helpers for workspace operations
 */

import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddRepositoryRequest,
  InviteMemberRequest,
  WorkspaceRole,
  WorkspaceVisibility,
  WorkspaceSettings,
} from '@/types/workspace';

// Regular expressions for validation
const WORKSPACE_NAME_REGEX = /^[a-zA-Z0-9\s\-_]{1,100}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate workspace name
 */
export function validateWorkspaceName(name: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!name || typeof name !== 'string') {
    errors.push({ field: 'name', message: 'Name is required' });
  } else {
    if (name.length < 1 || name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be between 1 and 100 characters' });
    }
    if (!WORKSPACE_NAME_REGEX.test(name)) {
      errors.push({ field: 'name', message: 'Name contains invalid characters' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate workspace description
 */
export function validateWorkspaceDescription(description?: string | null): ValidationResult {
  const errors: ValidationError[] = [];

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    } else if (description.length > 500) {
      errors.push({ field: 'description', message: 'Description must not exceed 500 characters' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate workspace visibility
 */
export function validateWorkspaceVisibility(visibility?: WorkspaceVisibility): ValidationResult {
  const errors: ValidationError[] = [];

  if (visibility !== undefined) {
    if (!['public', 'private'].includes(visibility)) {
      errors.push({
        field: 'visibility',
        message: 'Visibility must be either "public" or "private"',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate workspace settings
 */
export function validateWorkspaceSettings(settings?: WorkspaceSettings): ValidationResult {
  const errors: ValidationError[] = [];

  if (settings !== undefined && settings !== null) {
    if (typeof settings !== 'object') {
      errors.push({ field: 'settings', message: 'Settings must be an object' });
      return { valid: false, errors };
    }

    // Validate theme
    if (settings.theme !== undefined && !['default', 'dark', 'light'].includes(settings.theme)) {
      errors.push({ field: 'settings.theme', message: 'Invalid theme value' });
    }

    // Validate dashboard layout
    if (
      settings.dashboard_layout !== undefined &&
      !['grid', 'list', 'compact'].includes(settings.dashboard_layout)
    ) {
      errors.push({ field: 'settings.dashboard_layout', message: 'Invalid dashboard layout' });
    }

    // Validate default time range
    if (
      settings.default_time_range !== undefined &&
      !['7d', '30d', '90d', '1y'].includes(settings.default_time_range)
    ) {
      errors.push({ field: 'settings.default_time_range', message: 'Invalid default time range' });
    }

    // Validate custom branding
    if (settings.custom_branding) {
      if (
        settings.custom_branding.logo_url !== undefined &&
        typeof settings.custom_branding.logo_url !== 'string'
      ) {
        errors.push({
          field: 'settings.custom_branding.logo_url',
          message: 'Logo URL must be a string',
        });
      }
      if (settings.custom_branding.primary_color !== undefined) {
        const colorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!colorRegex.test(settings.custom_branding.primary_color)) {
          errors.push({
            field: 'settings.custom_branding.primary_color',
            message: 'Primary color must be a valid hex color',
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate create workspace request
 */
export function validateCreateWorkspace(_data: CreateWorkspaceRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate name
  const nameValidation = validateWorkspaceName(_data.name);
  errors.push(...nameValidation._errors);

  // Validate description
  const descriptionValidation = validateWorkspaceDescription(_data.description);
  errors.push(...descriptionValidation._errors);

  // Validate visibility
  const visibilityValidation = validateWorkspaceVisibility(_data.visibility);
  errors.push(...visibilityValidation._errors);

  // Validate settings
  const settingsValidation = validateWorkspaceSettings(_data.settings);
  errors.push(...settingsValidation._errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate update workspace request
 */
export function validateUpdateWorkspace(_data: UpdateWorkspaceRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // All fields are optional for update, but if provided must be valid
  if (_data.name !== undefined) {
    const nameValidation = validateWorkspaceName(_data.name);
    errors.push(...nameValidation._errors);
  }

  if (_data.description !== undefined) {
    const descriptionValidation = validateWorkspaceDescription(_data.description);
    errors.push(...descriptionValidation._errors);
  }

  if (_data.visibility !== undefined) {
    const visibilityValidation = validateWorkspaceVisibility(_data.visibility);
    errors.push(...visibilityValidation._errors);
  }

  if (_data.settings !== undefined) {
    const settingsValidation = validateWorkspaceSettings(_data.settings);
    errors.push(...settingsValidation._errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!email || typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate workspace role
 */
export function validateWorkspaceRole(role: string, allowOwner = false): ValidationResult {
  const errors: ValidationError[] = [];
  const validRoles: WorkspaceRole[] = allowOwner
    ? ['owner', 'admin', 'editor', 'viewer']
    : ['admin', 'editor', 'viewer'];

  if (!role || !validRoles.includes(role as WorkspaceRole)) {
    errors.push({
      field: 'role',
      message: `Role must be one of: ${validRoles.join(', ')}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate add repository request
 */
export function validateAddRepository(_data: AddRepositoryRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.repository_id || typeof _data.repository_id !== 'string') {
    errors.push({ field: 'repository_id', message: 'Repository ID is required' });
  }

  if (data.notes !== undefined && _data.notes !== null) {
    if (typeof _data.notes !== 'string') {
      errors.push({ field: 'notes', message: 'Notes must be a string' });
    } else if (_data.notes.length > 500) {
      errors.push({ field: 'notes', message: 'Notes must not exceed 500 characters' });
    }
  }

  if (_data.tags !== undefined) {
    if (!Array.isArray(_data.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    } else {
      data.tags.forEach((tag, index) => {
        if (typeof tag !== 'string') {
          errors.push({ field: `tags[${index}]`, message: 'Each tag must be a string' });
        } else if (tag.length > 50) {
          errors.push({
            field: `tags[${index}]`,
            message: 'Each tag must not exceed 50 characters',
          });
        }
      });
    }
  }

  if (data.is_pinned !== undefined && typeof _data.is_pinned !== 'boolean') {
    errors.push({ field: 'is_pinned', message: 'is_pinned must be a boolean' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate invite member request
 */
export function validateInviteMember(_data: InviteMemberRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate email
  const emailValidation = validateEmail(_data.email);
  errors.push(...emailValidation._errors);

  // Validate role
  const roleValidation = validateWorkspaceRole(_data.role, false);
  errors.push(...roleValidation._errors);

  // Validate custom message
  if (data.message !== undefined && _data.message !== null) {
    if (typeof _data.message !== 'string') {
      errors.push({ field: 'message', message: 'Message must be a string' });
    } else if (_data.message.length > 500) {
      errors.push({ field: 'message', message: 'Message must not exceed 500 characters' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(_errors: ValidationError[]): string {
  if (_errors.length === 0) return '';
  if (_errors.length === 1) return errors[0].message;

  return `Validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`;
}
