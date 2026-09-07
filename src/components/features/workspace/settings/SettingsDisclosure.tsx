import type { ReactNode } from 'react';
import { ChevronDown } from '@/components/ui/icon';

export function SettingsDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group min-w-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="min-w-0 px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}
