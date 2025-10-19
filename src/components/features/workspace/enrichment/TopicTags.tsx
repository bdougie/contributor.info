import { Badge } from '@/components/ui/badge';
import { Sparkles } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface TopicTagsProps {
  topics: string[];
  confidence?: number;
  /** Maximum number of topics to display */
  maxTopics?: number;
  className?: string;
  /** Size variant for tags */
  size?: 'sm' | 'md';
  /** Show confidence indicator */
  showConfidence?: boolean;
  /** Highlight new/shifted topics */
  highlightedTopics?: string[];
}

export function TopicTags({
  topics,
  confidence,
  maxTopics = 5,
  className,
  size = 'md',
  showConfidence = false,
  highlightedTopics = [],
}: TopicTagsProps) {
  if (!topics || topics.length === 0) {
    return null;
  }

  const displayTopics = topics.slice(0, maxTopics);
  const remainingCount = topics.length - displayTopics.length;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="list"
      aria-label="Expertise topics"
    >
      {displayTopics.map((topic, index) => {
        const isHighlighted = highlightedTopics.includes(topic);

        return (
          <Badge
            key={`${topic}-${index}`}
            variant="secondary"
            className={cn(
              'inline-flex items-center gap-1 font-medium',
              sizeClasses,
              isHighlighted &&
                'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground dark:border-primary/30'
            )}
            title={isHighlighted ? `New focus area: ${topic}` : topic}
            aria-label={isHighlighted ? `New focus area: ${topic}` : `Topic: ${topic}`}
          >
            {isHighlighted && <Sparkles className="h-3 w-3" aria-hidden="true" />}
            <span className="capitalize">{topic.replace(/_/g, ' ')}</span>
          </Badge>
        );
      })}

      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className={cn('font-medium text-muted-foreground', sizeClasses)}
          title={`${remainingCount} more topic${remainingCount > 1 ? 's' : ''}`}
          aria-label={`${remainingCount} more topics`}
        >
          +{remainingCount}
        </Badge>
      )}

      {showConfidence && confidence !== undefined && confidence > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title="Topic detection confidence"
          aria-label={`Confidence: ${Math.round(confidence * 100)}%`}
        >
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </div>
  );
}
