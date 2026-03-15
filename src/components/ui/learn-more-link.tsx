import { ExternalLink } from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';

interface LearnMoreLinkProps {
  href: string;
  feature: string;
  source: string;
  label?: string;
  className?: string;
}

export function LearnMoreLink({
  href,
  feature,
  source,
  label = 'Learn more',
  className,
}: LearnMoreLinkProps) {
  const { trackDocsLinkClicked } = useAnalytics();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${className ?? ''}`}
      onClick={() => trackDocsLinkClicked(feature, source, href)}
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}
