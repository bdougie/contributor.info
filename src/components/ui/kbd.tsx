import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type KbdProps = ComponentPropsWithoutRef<'kbd'>;

const Kbd = forwardRef<ElementRef<'kbd'>, KbdProps>(({ className, ...props }, ref) => {
  return (
    <kbd
      ref={ref}
      className={cn(
        'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground',
        className
      )}
      {...props}
    />
  );
});

Kbd.displayName = 'Kbd';

export { Kbd };
