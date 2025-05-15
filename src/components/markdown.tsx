import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={cn(
        'prose dark:prose-invert max-w-none',
        'prose-headings:mb-3 prose-headings:mt-4 prose-headings:font-semibold',
        'prose-p:mb-2 prose-p:leading-relaxed',
        'prose-li:mb-0.5',
        'prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted',
        className
      )}
    >
      {children}
    </ReactMarkdown>
  );
}