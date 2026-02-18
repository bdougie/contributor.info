import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Plus } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({ onSubmit, isLoading, onStop }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border p-3 shrink-0">
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Suggestions"
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this repository..."
          rows={1}
          disabled={isLoading}
          className={cn(
            'flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500',
            'disabled:opacity-50 min-h-[36px] max-h-[120px]'
          )}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        {isLoading ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <div className="h-3 w-3 rounded-sm bg-red-400" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0 bg-orange-500 hover:bg-orange-600"
            onClick={handleSubmit}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        AI can make mistakes. Check results.
      </p>
    </div>
  );
}
