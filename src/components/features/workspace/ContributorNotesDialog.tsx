import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Clock, AlertCircle, Settings, Trash2 } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { Contributor } from './ContributorsList';

export interface ContributorNote {
  id: string;
  note: string;
  created_by: {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ContributorNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributor: Contributor | null;
  notes: ContributorNote[];
  loading?: boolean;
  currentUserId?: string;
  onAddNote: (contributorId: string, note: string) => Promise<void>;
  onUpdateNote: (noteId: string, note: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

function getRelativeTime(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  if (diffInDays < 30)
    return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) === 1 ? '' : 's'} ago`;
  if (diffInDays < 365)
    return `${Math.floor(diffInDays / 30)} month${Math.floor(diffInDays / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(diffInDays / 365)} year${Math.floor(diffInDays / 365) === 1 ? '' : 's'} ago`;
}

export function ContributorNotesDialog({
  open,
  onOpenChange,
  contributor,
  notes,
  loading = false,
  currentUserId,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: ContributorNotesDialogProps) {
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewNote('');
      setEditingNoteId(null);
      setEditingNoteText('');
      setError(null);
    }
  }, [open]);

  const handleAddNote = async () => {
    if (!contributor || !newNote.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onAddNote(contributor.id, newNote.trim());
      setNewNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteText.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onUpdateNote(noteId, editingNoteText.trim());
      setEditingNoteId(null);
      setEditingNoteText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onDeleteNote(noteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingNote = (note: ContributorNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  if (!contributor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notes for {contributor.name || contributor.username}</DialogTitle>
          <DialogDescription>Add notes and context about this contributor</DialogDescription>
        </DialogHeader>

        {/* Contributor Info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <img
            src={contributor.avatar_url}
            alt={contributor.username}
            className="h-10 w-10 rounded-full"
          />
          <div className="flex-1">
            <p className="font-medium">{contributor.name || contributor.username}</p>
            <p className="text-sm text-muted-foreground">@{contributor.username}</p>
          </div>
          {contributor.company && (
            <div className="text-sm text-muted-foreground">{contributor.company}</div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Notes List */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            {(() => {
              if (loading) {
                return (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ))}
                  </div>
                );
              }
              if (notes.length > 0) {
                return (
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-3">
                      {notes.map((note) => {
                        const isEditing = editingNoteId === note.id;
                        const isOwner = currentUserId === note.created_by.id;

                        return (
                          <div
                            key={note.id}
                            className={cn(
                              'p-4 border rounded-lg space-y-2',
                              isEditing && 'ring-2 ring-primary'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={note.created_by.avatar_url} />
                                  <AvatarFallback>
                                    {note.created_by.display_name?.[0] || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">
                                  {note.created_by.display_name || note.created_by.email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  <Clock className="inline-block h-3 w-3 mr-1" />
                                  {getRelativeTime(note.created_at)}
                                  {note.updated_at !== note.created_at && ' (edited)'}
                                </span>
                              </div>
                              {isOwner && !isEditing && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditingNote(note)}
                                    disabled={isSubmitting}
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={isSubmitting}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  placeholder="Update your note..."
                                  rows={3}
                                  disabled={isSubmitting}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateNote(note.id)}
                                    disabled={isSubmitting || !editingNoteText.trim()}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditingNote}
                                    disabled={isSubmitting}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                );
              }
              return (
                <div className="text-center py-8 border rounded-lg">
                  <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add a note to provide context about this contributor
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Add Note Form */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add a Note</label>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add notes about this contributor..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleAddNote} disabled={isSubmitting || !newNote.trim()}>
            Add Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
