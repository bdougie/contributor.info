import { useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from '@/components/ui/icon';

/**
 * A collapsed settings row. Children are not mounted until the row is
 * opened, so sections that fetch on mount (subscription limits, backfill
 * status) do not run for rows nobody opens.
 */
export function SettingsDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
      <CollapsibleTrigger className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
        {title}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 px-5 pb-5 sm:px-6 sm:pb-6">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
