import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { ExternalLink } from './icon';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-8 text-center',
        className
      )}
    >
      {icon && <div className="mb-2 text-muted-foreground">{icon}</div>}
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
      {action && (
        <>
          {action.href ? (
            <Button variant="outline" size="sm" asChild>
              <a href={action.href} target="_blank" rel="noopener noreferrer">
                {action.label}
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
