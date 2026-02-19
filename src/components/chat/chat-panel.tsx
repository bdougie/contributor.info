import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useParams } from 'react-router';
import { Star, X, ChevronLeft, ChevronRight, Github } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { useCachedAuth } from '@/hooks/use-cached-auth';
import { useAuth } from '@/hooks/useAuth';
import { safeGetSession } from '@/lib/auth/safe-auth';
import { cn } from '@/lib/utils';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="border-t border-border p-4 shrink-0">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to chat with StarSearch</p>
        <Button variant="outline" className="w-full gap-2" onClick={onLogin}>
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  className?: string;
}

export function ChatPanel({ className }: ChatPanelProps) {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const { user, isAuthenticated } = useCachedAuth();
  const { login } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const userAvatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync panel state to #root so main content can use container queries
  // to adapt its responsive layout when the panel is open
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (isMobile) {
      root.removeAttribute('data-chat-panel');
      return;
    }
    root.setAttribute('data-chat-panel', isCollapsed ? 'collapsed' : 'open');
    return () => root.removeAttribute('data-chat-panel');
  }, [isCollapsed, isMobile]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { owner, repo, timeRange },
        headers: async (): Promise<Record<string, string>> => {
          const { session } = await safeGetSession();
          if (session?.access_token) {
            return { Authorization: `Bearer ${session.access_token}` };
          }
          return {};
        },
      }),
    [owner, repo, timeRange]
  );

  const [lastError, setLastError] = useState<string | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    onError: (err) => {
      console.error('[StarSearch] Chat error:', err);
      setLastError(err.message || 'An unknown error occurred');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSendMessage = useCallback(
    (text: string) => {
      setLastError(null);
      sendMessage({ text });
    },
    [sendMessage]
  );

  const handleOpen = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  if (!owner || !repo) return null;

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50 bg-orange-500 hover:bg-orange-600 text-white border-none"
            aria-label="Open StarSearch"
          >
            <Star className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[80vh] bg-background text-foreground border-border flex flex-col"
        >
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-400" />
              StarSearch
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatMessages
              messages={messages}
              owner={owner}
              repo={repo}
              isLoading={isLoading}
              userAvatarUrl={userAvatarUrl}
              error={error}
              lastErrorMessage={lastError}
              onExampleClick={handleSendMessage}
            />
          </div>
          {isAuthenticated ? (
            <ChatInput onSubmit={handleSendMessage} isLoading={isLoading} onStop={stop} />
          ) : (
            <LoginPrompt onLogin={login} />
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed sidebar — portaled to document.body to escape
  // #root's `contain: paint` which breaks position: fixed
  return createPortal(
    <div
      className={cn(
        'hidden md:flex fixed right-0 top-0 h-screen border-l transition-all duration-300 z-40',
        'bg-background text-foreground border-border flex-col',
        isCollapsed ? 'w-16' : 'w-[420px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center p-4 border-b border-border shrink-0">
        {!isCollapsed && (
          <>
            <Star className="h-5 w-5 text-orange-400 shrink-0" />
            <h2 className="flex-1 text-sm font-semibold tracking-wider text-center">StarSearch</h2>
          </>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed(true)}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (isCollapsed) {
                handleOpen();
              } else {
                setIsCollapsed(true);
              }
            }}
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isCollapsed ? (
        // Collapsed view — icon strip
        <div className="flex flex-col items-center pt-4 space-y-4">
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 text-orange-400 hover:text-orange-300"
            onClick={handleOpen}
            aria-label="Open StarSearch"
          >
            <Star className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        // Expanded view — chat (flex-1 + min-h-0 for proper overflow)
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatMessages
            messages={messages}
            owner={owner}
            repo={repo}
            isLoading={isLoading}
            userAvatarUrl={userAvatarUrl}
            error={error}
            onExampleClick={handleSendMessage}
          />
          {isAuthenticated ? (
            <ChatInput onSubmit={handleSendMessage} isLoading={isLoading} onStop={stop} />
          ) : (
            <LoginPrompt onLogin={login} />
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
