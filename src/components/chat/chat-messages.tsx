import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star } from '@/components/ui/icon';
import { ChatMessage } from './chat-message';
import type { UIMessage } from '@ai-sdk/react';

interface ChatMessagesProps {
  messages: UIMessage[];
  owner: string;
  repo: string;
  isLoading: boolean;
  userAvatarUrl?: string;
  error?: Error | null;
}

function EmptyState({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-[280px] space-y-4">
        <div className="mx-auto w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
          <Star className="h-5 w-5 text-orange-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Ask anything about {owner}/{repo}
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1.5 text-left">
            <li>Get a quick repo overview</li>
            <li>Find PRs that need attention</li>
            <li>Check repository health scores</li>
            <li>Get actionable recommendations</li>
          </ul>
        </div>
        <div className="rounded-md bg-muted/50 border border-border px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            StarSearch is a work in progress &mdash; more capabilities coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  owner,
  repo,
  isLoading,
  userAvatarUrl,
  error,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading && !error) {
    return <EmptyState owner={owner} repo={repo} />;
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="space-y-4 p-4">
        {messages.map((message, idx) => (
          <ChatMessage
            key={message.id}
            message={message}
            owner={owner}
            repo={repo}
            userAvatarUrl={userAvatarUrl}
            isStreaming={isLoading && idx === messages.length - 1 && message.role === 'assistant'}
          />
        ))}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
            Something went wrong. Please try again.
          </div>
        )}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-lg leading-none">
              🌱
            </span>
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
