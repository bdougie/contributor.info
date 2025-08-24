import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Loader2, GitBranch, Star, Package, X } from '@/components/ui/icon';
import { supabase } from '@/lib/supabase';
import type { AddRepositoryRequest } from '@/types/workspace';

interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  is_tracked: boolean;
}

export interface AddRepositoryFormProps {
  onSubmit: (data: AddRepositoryRequest) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
  workspaceId: string;
}

export function AddRepositoryForm({
  onSubmit,
  onCancel,
  loading = false,
  error,
  workspaceId
}: AddRepositoryFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Search for repositories
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      // Parse the query to extract owner/repo or just search term
      const parts = searchQuery.trim().split('/').filter(Boolean);
      
      let query = supabase
        .from('repositories')
        .select('id, owner, name, full_name, description, language, stargazers_count, is_tracked')
        .eq('is_tracked', true)
        .limit(10);

      if (parts.length === 2) {
        // Exact owner/repo search
        query = query
          .eq('owner', parts[0])
          .eq('name', parts[1]);
      } else if (parts.length === 1) {
        // Search by name or owner
        query = query.or(`name.ilike.%${parts[0]}%,owner.ilike.%${parts[0]}%,full_name.ilike.%${parts[0]}%`);
      } else {
        // Full text search
        query = query.or(`full_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error: searchErr } = await query;

      if (searchErr) {
        throw searchErr;
      }

      // Check which repos are already in the workspace
      if (data && data.length > 0) {
        const { data: existingRepos } = await supabase
          .from('workspace_repositories')
          .select('repository_id')
          .eq('workspace_id', workspaceId)
          .in('repository_id', data.map(r => r.id));

        const existingRepoIds = new Set(existingRepos?.map(r => r.repository_id) || []);
        
        // Filter out repos already in workspace
        const availableRepos = data.filter(r => !existingRepoIds.has(r.id));
        
        if (availableRepos.length === 0 && data.length > 0) {
          setSearchError('All matching repositories are already in this workspace');
        } else {
          setSearchResults(availableRepos);
        }
      } else {
        setSearchError('No tracked repositories found. Try searching for repositories that are already being tracked.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Failed to search repositories');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, workspaceId]);

  // Handle tag addition
  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  // Handle tag removal
  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter(t => t !== tag));
  }, [tags]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRepo) {
      return;
    }

    await onSubmit({
      repository_id: selectedRepo.id,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      is_pinned: isPinned
    });
  }, [selectedRepo, notes, tags, isPinned, onSubmit]);

  // Handle Enter key in search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  // Handle Enter key in tag input
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Repository Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Search Repository</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by owner/repo or keyword..."
              className="pl-9"
              disabled={loading || searching}
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={loading || searching || !searchQuery.trim()}
            variant="secondary"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Search for tracked repositories by owner/name (e.g., "facebook/react") or keywords
        </p>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <Label>Select Repository</Label>
          <ScrollArea className="h-[200px] rounded-md border">
            <div className="p-2 space-y-2">
              {searchResults.map((repo) => (
                <Card
                  key={repo.id}
                  className={`cursor-pointer transition-colors ${
                    selectedRepo?.id === repo.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{repo.full_name}</span>
                        </div>
                        {repo.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stargazers_count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <Alert variant="default">
          <AlertDescription>{searchError}</AlertDescription>
        </Alert>
      )}

      {/* Selected Repository Details */}
      {selectedRepo && (
        <>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Selected: {selectedRepo.full_name}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this repository..."
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tags..."
                disabled={loading}
              />
              <Button
                type="button"
                onClick={handleAddTag}
                disabled={loading || !tagInput.trim()}
                variant="secondary"
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                      disabled={loading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Pin Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="pinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              disabled={loading}
              className="rounded border-gray-300"
            />
            <Label htmlFor="pinned" className="text-sm font-normal cursor-pointer">
              Pin this repository to the top of your workspace
            </Label>
          </div>
        </>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading || !selectedRepo}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Repository'
          )}
        </Button>
      </div>
    </form>
  );
}