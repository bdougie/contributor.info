import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';


export interface ContributorGroup {
  id: string;
  workspace_id?: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface ContributorGroupMember {
  id: string;
  group_id: string;
  contributor_username: string;
  workspace_id: string;
  added_at: string;
  added_by: string | null;
}

export interface ContributorNote {
  id: string;
  contributorId?: string;
  workspace_id?: string;
  contributor_username?: string;
  note: string;
  note_content?: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export function useContributorGroups(workspaceId: string | undefined) {
  const [groups, setGroups] = useState<ContributorGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<ContributorGroupMember[]>([]);
  const [notes, setNotes] = useState<ContributorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch groups and members
  const fetchGroups = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('contributor_groups')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_system', { ascending: false })
        .order('name', { ascending: true });

      if (groupsError) throw groupsError;

      // Fetch group members
      const { data: membersData, error: membersError } = await supabase
        .from('contributor_group_members')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (membersError) throw membersError;

      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
        .from('contributor_notes')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (notesError) throw notesError;

      const mappedGroups = (groupsData || []);

      // Map notes to match expected interface
      const mappedNotes = (notesData || []).map(note => ({
        ...note,
        note: note.note_content,
        contributorId: note.contributor_username, // Use username as ID for now
      }));

      setGroups(mappedGroups);
      setGroupMembers(membersData || []);
      setNotes(mappedNotes);
    } catch (err) {
      console.error('Error fetching contributor groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Create a new group
  const createGroup = useCallback(
    async (name: string, description: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('contributor_groups')
        .insert({
          workspace_id: workspaceId,
          name,
          description: description || null,
          is_system: false,
          created_by: user.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to create group');

      setGroups(prev => [...prev, data]);
      toast.success(`Group "${name}" created successfully`);
      return data;
    },
    [workspaceId]
  );

  // Update a group
  const updateGroup = useCallback(
    async (groupId: string, name: string, description: string) => {
      const { data, error } = await supabase
        .from('contributor_groups')
        .update({
          name,
          description: description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId)
        .eq('is_system', false) // Prevent updating system groups
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to update group');

      setGroups(prev => prev.map(g => g.id === groupId ? data : g));
      toast.success(`Group "${name}" updated successfully`);
      return data;
    },
    []
  );

  // Delete a group
  const deleteGroup = useCallback(
    async (groupId: string) => {
      const group = groups.find(g => g.id === groupId);
      if (group?.is_system) {
        throw new Error('Cannot delete system groups');
      }

      const { error } = await supabase
        .from('contributor_groups')
        .delete()
        .eq('id', groupId)
        .eq('is_system', false); // Extra safety check

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== groupId));
      setGroupMembers(prev => prev.filter(m => m.group_id !== groupId));
      toast.success('Group deleted successfully');
    },
    [groups]
  );

  // Add contributor to group
  const addContributorToGroup = useCallback(
    async (contributorUsername: string, groupId: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if already in group
      const existing = groupMembers.find(
        m => m.contributor_username === contributorUsername && m.group_id === groupId
      );
      if (existing) {
        toast.info('Contributor is already in this group');
        return;
      }

      const { data, error } = await supabase
        .from('contributor_group_members')
        .insert({
          group_id: groupId,
          contributor_username: contributorUsername,
          workspace_id: workspaceId,
          added_by: user.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to add contributor to group');

      setGroupMembers(prev => [...prev, data]);

      const group = groups.find(g => g.id === groupId);
      toast.success(`Added to "${group?.name}" group`);
      return data;
    },
    [workspaceId, groupMembers, groups]
  );

  // Remove contributor from group
  const removeContributorFromGroup = useCallback(
    async (contributorUsername: string, groupId: string) => {
      const member = groupMembers.find(
        m => m.contributor_username === contributorUsername && m.group_id === groupId
      );

      if (!member) {
        toast.error('Contributor is not in this group');
        return;
      }

      const { error } = await supabase
        .from('contributor_group_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      setGroupMembers(prev => prev.filter(m => m.id !== member.id));

      const group = groups.find(g => g.id === groupId);
      toast.success(`Removed from "${group?.name}" group`);
    },
    [groupMembers, groups]
  );

  // Add or update a note for a contributor
  const upsertNote = useCallback(
    async (contributorUsername: string, noteContent: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const existingNote = notes.find(n => n.contributor_username === contributorUsername);

      if (existingNote) {
        // Update existing note
        const { data, error } = await supabase
          .from('contributor_notes')
          .update({
            note_content: noteContent,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', existingNote.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Failed to update note');

        setNotes(prev => prev.map(n => n.id === existingNote.id ? data : n));
        toast.success('Note updated successfully');
        return data;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from('contributor_notes')
          .insert({
            workspace_id: workspaceId,
            contributor_username: contributorUsername,
            note_content: noteContent,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Failed to create note');

        setNotes(prev => [...prev, data]);
        toast.success('Note added successfully');
        return data;
      }
    },
    [workspaceId, notes]
  );

  // Delete a note
  const deleteNote = useCallback(
    async (contributorUsername: string) => {
      const note = notes.find(n => n.contributor_username === contributorUsername);
      if (!note) {
        toast.error('No note found for this contributor');
        return;
      }

      const { error } = await supabase
        .from('contributor_notes')
        .delete()
        .eq('id', note.id);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== note.id));
      toast.success('Note deleted successfully');
    },
    [notes]
  );

  // Get contributor's groups as a Map for easy lookup
  const getContributorGroupsMap = useCallback(() => {
    const map = new Map<string, string[]>();

    groupMembers.forEach(member => {
      const current = map.get(member.contributor_username) || [];
      current.push(member.group_id);
      map.set(member.contributor_username, current);
    });

    return map;
  }, [groupMembers]);

  // Get note for a specific contributor
  const getContributorNote = useCallback(
    (contributorUsername: string) => {
      return notes.find(n => n.contributor_username === contributorUsername);
    },
    [notes]
  );

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    groupMembers,
    notes,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    addContributorToGroup,
    removeContributorFromGroup,
    upsertNote,
    deleteNote,
    getContributorGroupsMap,
    getContributorNote,
    refetch: fetchGroups,
  };
}