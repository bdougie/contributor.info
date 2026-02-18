import { lazy, Suspense } from 'react';
import { User } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendationCard } from './chat-cards/recommendation-card';
import { PrAlertCard } from './chat-cards/pr-alert-card';
import { HealthCard } from './chat-cards/health-card';
import type { UIMessage } from '@ai-sdk/react';
import type { RecommendationsData, PrAttentionData, HealthAssessmentData } from './types';

const ReactMarkdown = lazy(() => import('react-markdown'));

interface ChatMessageProps {
  message: UIMessage;
  owner: string;
  repo: string;
  userAvatarUrl?: string;
  isStreaming?: boolean;
  errorMessage?: string | null;
}

function ToolResultCard({
  toolName,
  result,
  owner,
  repo,
}: {
  toolName: string;
  result: Record<string, unknown>;
  owner: string;
  repo: string;
}) {
  switch (toolName) {
    case 'get_recommendations':
      return <RecommendationCard data={result as unknown as RecommendationsData} />;
    case 'get_prs_needing_attention':
      return <PrAlertCard data={result as unknown as PrAttentionData} owner={owner} repo={repo} />;
    case 'get_health_assessment':
      return <HealthCard data={result as unknown as HealthAssessmentData} />;
    default:
      return null;
  }
}

function sanitizeImageUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function ChatAvatar({ isUser, avatarUrl }: { isUser: boolean; avatarUrl?: string }) {
  if (!isUser) {
    return (
      <span
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-lg leading-none"
        aria-label="contributor.info"
      >
        🌱
      </span>
    );
  }

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt="You" className="flex-shrink-0 w-7 h-7 rounded-full object-cover" />
    );
  }

  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-orange-500 text-white">
      <User className="h-4 w-4" />
    </div>
  );
}

export function ChatMessage({
  message,
  owner,
  repo,
  userAvatarUrl,
  isStreaming,
  errorMessage,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const safeAvatarUrl = userAvatarUrl ? sanitizeImageUrl(userAvatarUrl) : undefined;

  // Check if any part will produce visible content
  const hasVisibleContent =
    isUser ||
    message.parts.some((part) => {
      if (part.type === 'text' && part.text.trim()) return true;
      if (part.type === 'dynamic-tool') return true;
      return false;
    });

  // While streaming, the loading dots in ChatMessages handle the "waiting" state
  // so don't render an empty bubble that flickers before content arrives
  if (!hasVisibleContent && isStreaming) return null;

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <ChatAvatar isUser={isUser} avatarUrl={safeAvatarUrl} />

      {/* Message content */}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-orange-500 text-white' : 'bg-muted text-foreground'
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === 'text' && part.text.trim()) {
            return (
              <Suspense key={i} fallback={<span>{part.text}</span>}>
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{part.text}</ReactMarkdown>
                </div>
              </Suspense>
            );
          }

          if (part.type === 'dynamic-tool') {
            if (part.state === 'output-available') {
              return (
                <div key={i} className="mt-2">
                  <ToolResultCard
                    toolName={part.toolName}
                    result={part.output as Record<string, unknown>}
                    owner={owner}
                    repo={repo}
                  />
                </div>
              );
            }
            // Loading state for in-progress tool calls
            return (
              <div key={i} className="mt-2 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            );
          }

          return null;
        })}

        {/* Fallback when stream ended with no visible output */}
        {!isUser && !isStreaming && !hasVisibleContent && (
          <div className="space-y-1">
            <p className="text-muted-foreground italic">
              Sorry, I couldn&apos;t generate a response. Please try again.
            </p>
            {errorMessage && (
              <p className="text-xs text-red-400/80 font-mono">Error: {errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
