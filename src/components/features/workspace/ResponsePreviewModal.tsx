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
import { Check, Copy, Loader2 } from '@/components/ui/icon';
import type { SimilarItem } from '@/services/similarity-search';
import { generateResponseMessage } from '@/services/similarity-search';

export interface ResponsePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  similarItems: SimilarItem[];
  responseMessage: string;
  onCopyToClipboard?: () => void;
}

export function ResponsePreviewModal({
  open,
  onOpenChange,
  loading = false,
  similarItems,
  onCopyToClipboard,
}: ResponsePreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
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
        </div>

        {/* Similar items details with similarity scores */}
        {similarItemsSection}

        {noItemsAlert}
      </div>
    );
  }

  // Avoid ternary - Rollup 4.45.0 bug (see docs/architecture/state-machine-patterns.md)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respond with Similar Items</DialogTitle>
          <DialogDescription>
            Preview the generated response before copying to paste manually
          </DialogDescription>
        </DialogHeader>

        {mainContent}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCopy} disabled={loading || copied}>
            {buttonContent}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
