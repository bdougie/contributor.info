import { describe, it, expect } from 'vitest';

// Mock ContributorNote type matching useContributorGroups
interface ContributorNote {
  id: string;
  workspace_id?: string;
  contributor_username?: string;
  note: string;
  note_content?: string;
  created_at: string;
  updated_at: string;
  created_by:
    | {
        auth_user_id: string | null;
        email: string;
        display_name: string;
      }
    | string
    | null;
  updated_by:
    | {
        auth_user_id: string | null;
        email: string;
        display_name: string;
      }
    | string
    | null;
}

// Helper function extracted from workspace-page.tsx transformedNotes logic
function transformNotes(notes: ContributorNote[], contributorUsername: string | undefined) {
  if (!contributorUsername) return [];

  return notes
    .filter((note) => note.contributor_username === contributorUsername)
    .map((note) => {
      const createdBy = note.created_by as
        | {
            auth_user_id: string;
            email: string;
            display_name: string;
          }
        | string
        | null;
      const isObject = typeof createdBy === 'object' && createdBy !== null;

      return {
        ...note,
        created_by: {
          id: isObject ? createdBy.auth_user_id : createdBy || 'unknown',
          email: isObject ? createdBy.email : 'unknown@example.com',
          display_name: isObject
            ? createdBy.display_name || createdBy.email?.split('@')[0]
            : 'Unknown User',
          avatar_url: undefined,
        },
      };
    });
}

describe('workspace-page - Notes filtering', () => {
  const mockNotes: ContributorNote[] = [
    {
      id: 'note-1',
      workspace_id: 'workspace-123',
      contributor_username: 'alice',
      note: 'Note about Alice',
      note_content: 'Note about Alice',
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-01-01T10:00:00Z',
      created_by: {
        auth_user_id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
      },
      updated_by: {
        auth_user_id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
      },
    },
    {
      id: 'note-2',
      workspace_id: 'workspace-123',
      contributor_username: 'bob',
      note: 'Note about Bob',
      note_content: 'Note about Bob',
      created_at: '2025-01-01T11:00:00Z',
      updated_at: '2025-01-01T11:00:00Z',
      created_by: {
        auth_user_id: 'user-456',
        email: 'user2@example.com',
        display_name: 'User Two',
      },
      updated_by: {
        auth_user_id: 'user-456',
        email: 'user2@example.com',
        display_name: 'User Two',
      },
    },
    {
      id: 'note-3',
      workspace_id: 'workspace-123',
      contributor_username: 'alice',
      note: 'Another note about Alice',
      note_content: 'Another note about Alice',
      created_at: '2025-01-01T12:00:00Z',
      updated_at: '2025-01-01T12:00:00Z',
      created_by: {
        auth_user_id: 'user-789',
        email: 'user3@example.com',
        display_name: 'User Three',
      },
      updated_by: {
        auth_user_id: 'user-789',
        email: 'user3@example.com',
        display_name: 'User Three',
      },
    },
  ];

  describe('transformNotes filtering', () => {
    it('should filter notes by selected contributor username', () => {
      const result = transformNotes(mockNotes, 'alice');

      // Should only return notes for 'alice'
      expect(result).toHaveLength(2);
      expect(result[0].contributor_username).toBe('alice');
      expect(result[1].contributor_username).toBe('alice');
      expect(result[0].note).toBe('Note about Alice');
      expect(result[1].note).toBe('Another note about Alice');
    });

    it('should return empty array when no contributor is selected', () => {
      const result = transformNotes(mockNotes, undefined);
      expect(result).toEqual([]);
    });

    it('should prevent cross-user data leak by isolating notes per contributor', () => {
      const result = transformNotes(mockNotes, 'bob');

      // Should only return Bob's note, not Alice's notes
      expect(result).toHaveLength(1);
      expect(result[0].contributor_username).toBe('bob');
      expect(result[0].note).toBe('Note about Bob');

      // Verify Alice's notes are NOT included
      const aliceNotes = result.filter((note) => note.contributor_username === 'alice');
      expect(aliceNotes).toHaveLength(0);
    });

    it('should transform created_by to match dialog interface', () => {
      const result = transformNotes(mockNotes, 'alice');

      // Verify transformation
      expect(result[0].created_by).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: undefined,
      });

      expect(result[1].created_by).toEqual({
        id: 'user-789',
        email: 'user3@example.com',
        display_name: 'User Three',
        avatar_url: undefined,
      });
    });

    it('should handle string-type created_by gracefully', () => {
      const noteWithStringCreatedBy: ContributorNote = {
        id: 'note-4',
        workspace_id: 'workspace-123',
        contributor_username: 'charlie',
        note: 'Note with string created_by',
        note_content: 'Note with string created_by',
        created_at: '2025-01-01T13:00:00Z',
        updated_at: '2025-01-01T13:00:00Z',
        created_by: 'user-string-id',
        updated_by: 'user-string-id',
      };

      const notesWithString = [...mockNotes, noteWithStringCreatedBy];
      const result = transformNotes(notesWithString, 'charlie');

      expect(result[0].created_by).toEqual({
        id: 'user-string-id',
        email: 'unknown@example.com',
        display_name: 'Unknown User',
        avatar_url: undefined,
      });
    });

    it('should return empty array for non-existent contributor', () => {
      const result = transformNotes(mockNotes, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('should handle empty notes array', () => {
      const result = transformNotes([], 'alice');
      expect(result).toEqual([]);
    });
  });
});
