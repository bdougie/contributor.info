import { type ComponentPropsWithoutRef, type ElementRef, type Ref, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface KbdProps extends ComponentPropsWithoutRef<'kbd'> {
  ref?: Ref<ElementRef<'kbd'>>;
}

const Kbd = forwardRef<ElementRef<'kbd'>, KbdProps>(({ className, ...props }, ref) => {
  return (
    <kbd
      ref={ref}
      className={cn(
        'pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100',
        className
      )}
      {...props}
    />
  );
});

Kbd.displayName = 'Kbd';

export { Kbd };
