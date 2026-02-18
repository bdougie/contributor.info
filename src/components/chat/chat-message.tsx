import { lazy, Suspense } from 'react';
import { Bot, User } from '@/components/ui/icon';
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

export function ChatMessage({ message, owner, repo, userAvatarUrl }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {isUser && userAvatarUrl ? (
        <img
          src={userAvatarUrl}
          alt="You"
          className="flex-shrink-0 w-7 h-7 rounded-full object-cover"
        />
      ) : (
        <div
          className={cn(
            'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
            isUser ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

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
      </div>
    </div>
  );
}
