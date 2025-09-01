import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/optimized-image';

// Lazy load ReactMarkdown
const ReactMarkdown = lazy(() => import('react-markdown'));

interface MarkdownProps {
  children: string;
  className?: string;
}

// Helper function to generate heading IDs
const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .trim();
};

// Skeleton loader for markdown content
function MarkdownSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse space-y-3', className)}>
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/5" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-2/3" />
    </div>
  );
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <Suspense fallback={<MarkdownSkeleton className={className} />}>
      <ReactMarkdown
        className={cn(
          'prose dark:prose-invert max-w-none',
          'prose-headings:mb-3 prose-headings:mt-4 prose-headings:font-semibold',
          'prose-p:mb-2 prose-p:leading-relaxed',
          'prose-li:mb-0.5',
          'prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted',
          className
        )}
        components={{
          h1: ({ children }) => {
            const text = String(children);
            const id = generateHeadingId(text);
            return <h1 id={id}>{children}</h1>;
          },
          h2: ({ children }) => {
            const text = String(children);
            const id = generateHeadingId(text);
            return <h2 id={id}>{children}</h2>;
          },
          h3: ({ children }) => {
            const text = String(children);
            const id = generateHeadingId(text);
            return <h3 id={id}>{children}</h3>;
          },
          img: ({ src, alt }) => {
            // Determine if image should be priority loaded (above the fold)
            const isPriority = src?.includes('hero') || src?.includes('banner');

            return (
              <OptimizedImage
                src={src || ''}
                alt={alt || ''}
                lazy={!isPriority}
                priority={isPriority}
                className="rounded-lg shadow-sm"
              />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </Suspense>
  );
}
