import { describe, it, expect } from 'vitest';
import {
  isUUID,
  isSlug,
  parseWorkspaceIdentifier,
  getWorkspaceQueryField,
} from '@/types/workspace-identifier';

describe('Workspace Identifier Type Safety', () => {
  describe('isUUID', () => {
    it('should correctly identify valid UUIDs', () => {
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isUUID('6BA7B810-9DAD-11D1-80B4-00C04FD430C8')).toBe(true); // Case insensitive
    });

    it('should reject invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('550e8400-e29b-41d4-a716')).toBe(false); // Too short
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false); // Too long
      expect(isUUID('my-workspace-slug')).toBe(false);
    });
  });

  describe('isSlug', () => {
    it('should correctly identify valid slugs', () => {
      expect(isSlug('my-workspace')).toBe(true);
      expect(isSlug('workspace123')).toBe(true);
      expect(isSlug('test-workspace-2024')).toBe(true);
    });

    it('should reject invalid slugs', () => {
      expect(isSlug('550e8400-e29b-41d4-a716-446655440000')).toBe(false); // UUID
      expect(isSlug('My-Workspace')).toBe(false); // Capital letters
      expect(isSlug('workspace with spaces')).toBe(false);
      expect(isSlug('workspace_underscore')).toBe(false);
    });
  });

  describe('parseWorkspaceIdentifier', () => {
    it('should parse UUID correctly', () => {
      const result = parseWorkspaceIdentifier('550e8400-e29b-41d4-a716-446655440000');
      expect(result.type).toBe('uuid');
      expect(result.value).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should parse slug correctly', () => {
      const result = parseWorkspaceIdentifier('my-workspace-slug');
      expect(result.type).toBe('slug');
      expect(result.value).toBe('my-workspace-slug');
    });
  });

  describe('getWorkspaceQueryField', () => {
    it('should return correct field for UUID', () => {
      const identifier = parseWorkspaceIdentifier('550e8400-e29b-41d4-a716-446655440000');
      const result = getWorkspaceQueryField(identifier);
      expect(result.field).toBe('id');
      expect(result.value).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return correct field for slug', () => {
      const identifier = parseWorkspaceIdentifier('my-workspace');
      const result = getWorkspaceQueryField(identifier);
      expect(result.field).toBe('slug');
      expect(result.value).toBe('my-workspace');
    });
  });
});
