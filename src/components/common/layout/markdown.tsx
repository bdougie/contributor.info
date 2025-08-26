import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/optimized-image';

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

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={cn(
        'prose dark:prose-invert max-w-none',
        'prose-headings:mb-3 prose-headings:mt-4 prose-headings:font-semibold',
        'prose-p:mb-2 prose-p:leading-relaxed',
        'prose-li:mb-0.5',
        'prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted',
        className,
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
  );
}
