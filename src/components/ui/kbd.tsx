import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type KbdProps = HTMLAttributes<HTMLElement>;

const Kbd = forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
      className
    )}
    {...props}
  />
));
Kbd.displayName = 'Kbd';

export { Kbd };
