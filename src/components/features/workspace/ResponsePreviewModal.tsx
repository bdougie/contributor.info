import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Copy, Loader2, ExternalLink } from '@/components/ui/icon';
import type { SimilarItem } from '@/services/similarity-search';
import { generateResponseMessage } from '@/services/similarity-search';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface CurrentItem {
  id: string;
  type: 'pr' | 'issue' | 'discussion';
  url: string;
  number: number;
  title: string;
  repository: string;
}

export interface ResponsePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  similarItems: SimilarItem[];
  responseMessage: string;
  onCopyToClipboard?: () => void;
  currentItem?: CurrentItem;
  workspaceId?: string;
  onItemMarkedAsResponded?: () => void;
}

export function ResponsePreviewModal({
  open,
  onOpenChange,
  loading = false,
  similarItems,
  onCopyToClipboard,
  currentItem,
  workspaceId,
  onItemMarkedAsResponded,
}: ResponsePreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [markingAsResponded, setMarkingAsResponded] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging for button visibility
  useEffect(() => {
    if (open) {
      console.log('ResponsePreviewModal opened:', {
        currentItem: currentItem ? { id: currentItem.id, type: currentItem.type } : null,
        workspaceId,
        shouldShowButton: !!(currentItem && workspaceId),
      });
    }
  }, [open, currentItem, workspaceId]);

  // Initialize all items as selected when modal opens
  useEffect(() => {
    if (open && similarItems.length > 0) {
      setSelectedItems(new Set(similarItems.map((item) => item.id)));
    }
  }, [open, similarItems]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Generate response message based on selected items
  const responseMessage = useMemo(() => {
    const filteredItems = similarItems.filter((item) => selectedItems.has(item.id));
    return generateResponseMessage(filteredItems);
  }, [similarItems, selectedItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(responseMessage);
      setCopied(true);
      onCopyToClipboard?.();

      // Clear any existing timeout
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      // Reset copied state after 2 seconds
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleMarkAsResponded = async () => {
    if (!currentItem || !workspaceId) {
      return;
    }

    setMarkingAsResponded(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('You must be logged in to mark items as responded.');
        setMarkingAsResponded(false);
        return;
      }

      // Determine the table name based on item type
      const tableName = currentItem.type === 'issue' ? 'issues' : 'discussions';

      // Extract the actual database ID by removing the prefix
      // MyWorkItem IDs have format: "issue-{id}" or "discussion-{id}"
      const actualId = currentItem.id.replace(/^(issue-|discussion-|review-pr-)/, '');

      // Optimistically trigger refresh BEFORE the database update
      // This immediately removes the item from the UI for better UX
      onItemMarkedAsResponded?.();

      // Close the modal immediately after triggering refresh
      onOpenChange(false);

      // Update the item with responded_by and responded_at
      const { error } = await supabase
        .from(tableName)
        .update({
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', actualId);

      if (error) {
        console.error('Error marking item as responded: %s', error.message);
        toast.error(`Failed to mark as responded: ${error.message}. Please refresh.`);
        // Trigger another refresh to show the item again since update failed
        onItemMarkedAsResponded?.();
        return;
      }

      toast.success(
        `${currentItem.type === 'issue' ? 'Issue' : 'Discussion'} #${currentItem.number} marked as responded.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error marking item as responded: %s', errorMessage);
      toast.error(`Failed to mark as responded: ${errorMessage}. Please refresh.`);
      // Trigger refresh to restore proper state
      onItemMarkedAsResponded?.();
    } finally {
      setMarkingAsResponded(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (currentItem?.url) {
      window.open(currentItem.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getItemTypeLabel = (type: 'pr' | 'issue' | 'discussion'): string => {
    if (type === 'issue') return 'Issue';
    if (type === 'discussion') return 'Discussion';
    return 'PR';
  };

  // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
  // Build button content first since it's used in mainContent
  let buttonContent;
  if (copied) {
    buttonContent = (
      <>
        <Check className="h-4 w-4 mr-2" />
        Copied!
      </>
    );
  } else {
    buttonContent = (
      <>
        <Copy className="h-4 w-4 mr-2" />
        Copy to Clipboard
      </>
    );
  }

  let mainContent;
  if (loading) {
    mainContent = (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">
          Finding similar items in workspace...
        </span>
      </div>
    );
  } else {
    // Build conditional sections to avoid Rollup 4.45.0 bug
    let similarItemsSection = null;
    if (similarItems.length > 0) {
      similarItemsSection = (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Similar Items Found:{' '}
            <span className="text-muted-foreground font-normal text-xs">
              (uncheck items that aren't relevant)
            </span>
          </h4>
          <div className="space-y-2">
            {similarItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              return (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded border bg-card">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {item.type} #{item.number}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                        {item.repository}
                      </span>
                      {item.status === 'answered' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Answered
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 line-clamp-1">{item.title}</p>
                  </div>
                  <div className="flex-shrink-0 ml-3 text-right">
                    <span className="text-xs text-muted-foreground">
                      {Math.round(item.similarity * 100)}% match
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    let noItemsAlert = null;
    if (similarItems.length === 0 && !loading) {
      noItemsAlert = (
        <Alert>
          <AlertDescription>
            <strong>No similar items available yet.</strong> Our system generates AI embeddings for
            similarity search in the background. This typically completes within 15-30 minutes for
            new workspaces. You can still copy and paste the response manually.
          </AlertDescription>
        </Alert>
      );
    }

    mainContent = (
      <div className="space-y-4">
        {/* Preview of the response */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-2">Response Preview:</h4>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm font-mono bg-background p-3 rounded border">
              {responseMessage}
            </pre>
          </div>

          {/* Copy button below preview */}
          <div className="mt-3">
            <Button onClick={handleCopy} disabled={loading || copied} className="w-full">
              {buttonContent}
            </Button>
          </div>
        </div>

        {/* Similar items details with similarity scores */}
        {similarItemsSection}

        {noItemsAlert}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respond with Similar Items</DialogTitle>
          {currentItem && (
            <a
              href={currentItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-foreground hover:text-primary hover:underline pt-2 pb-1 inline-flex items-center gap-1"
            >
              {getItemTypeLabel(currentItem.type)} #{currentItem.number}: {currentItem.title}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <DialogDescription>
            Preview the generated response before copying to paste manually
          </DialogDescription>
        </DialogHeader>

        {mainContent}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          {/* Left side: Link button */}
          <div className="flex gap-2">
            {currentItem && (
              <Button
                variant="outline"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open {getItemTypeLabel(currentItem.type)} #{currentItem.number}
              </Button>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {currentItem && workspaceId && (
              <Button
                onClick={handleMarkAsResponded}
                disabled={loading || markingAsResponded}
                variant="default"
              >
                {markingAsResponded ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Responded
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
