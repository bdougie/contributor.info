/**
 * Type-safe workspace identifier handling
 * Distinguishes between UUID and slug identifiers
 */

// Brand types for type safety
export type UUID = string & { readonly __brand: 'UUID' };
export type Slug = string & { readonly __brand: 'Slug' };

// Discriminated union for workspace identifiers
export type WorkspaceIdentifier = { type: 'uuid'; value: UUID } | { type: 'slug'; value: Slug };

// Type guards
export function isUUID(value: string): value is UUID {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isSlug(value: string): value is Slug {
  // Slugs are alphanumeric with hyphens, not UUIDs
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return !isUUID(value) && slugRegex.test(value);
}

// Helper to parse workspace identifier
export function parseWorkspaceIdentifier(value: string): WorkspaceIdentifier {
  if (isUUID(value)) {
    return { type: 'uuid', value: value as UUID };
  }
  return { type: 'slug', value: value as Slug };
}

// Helper to get the appropriate database query field
export function getWorkspaceQueryField(identifier: WorkspaceIdentifier): {
  field: 'id' | 'slug';
  value: string;
} {
  return {
    field: identifier.type === 'uuid' ? 'id' : 'slug',
    value: identifier.value,
  };
}
