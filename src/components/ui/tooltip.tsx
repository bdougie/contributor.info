import type { ComponentPropsWithoutRef, ElementRef, Ref } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps
  extends ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  ref?: Ref<ElementRef<typeof TooltipPrimitive.Content>>;
}

function TooltipContent({ className, sideOffset = 4, ref, ...props }: TooltipContentProps) {
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground border animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
