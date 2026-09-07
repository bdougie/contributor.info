import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SectionNavigationItem {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

const listClass = 'h-auto min-h-12 gap-1 p-1';
const triggerClass = 'min-h-11 shrink-0 gap-2 px-3 py-2 text-sm';

function ItemLabel({ item }: { item: SectionNavigationItem }) {
  return (
    <>
      {item.icon && (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {item.icon}
        </span>
      )}
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
        </Badge>
      )}
    </>
  );
}

/** Shares the surrounding controlled Tabs value; compact selection uses the same route callback. */
export function SectionNavigation({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: SectionNavigationItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const select = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [compact, setCompact] = useState(true);
  const compactMode = useRef(compact);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    compactMode.current = compact;
    if (!compact) setOpen(false);
  }, [compact]);

  useLayoutEffect(() => {
    const root = container.current;
    const row = measure.current;
    if (!root || !row) return;
    const update = () => {
      const available = root.getBoundingClientRect().width;
      if (!available) return;
      const next = row.getBoundingClientRect().width + 1 > available;
      setCompact((previous) => {
        if (
          previous !== next &&
          (root.contains(document.activeElement) ||
            select.current?.getAttribute('aria-expanded') === 'true')
        )
          restoreFocus.current = true;
        return next;
      });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(root);
    observer?.observe(row);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [items]);

  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    if (compact) select.current?.focus();
    else
      container.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus();
  }, [compact]);

  return (
    <div ref={container} className={cn('relative min-w-0 w-full', className)}>
      {/* Measure non-interactive content even while the real tab row is hidden. */}
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <div ref={measure} className={cn('inline-flex w-max items-center rounded-lg', listClass)}>
          {items.map((item) => (
            <span
              key={item.value}
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium',
                triggerClass
              )}
            >
              <ItemLabel item={item} />
            </span>
          ))}
        </div>
      </div>
      <div hidden={!compact} className="space-y-1.5 sm:max-w-xs">
        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <Select
          value={value}
          onValueChange={onValueChange}
          open={open && compact}
          onOpenChange={setOpen}
        >
          <SelectTrigger
            ref={select}
            id={id}
            className="h-11 rounded-lg bg-background text-base font-medium transition-colors hover:bg-muted/50 focus:ring-0 focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 sm:text-sm"
          >
            <SelectValue placeholder="Select a section" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] rounded-lg border-border bg-popover shadow-lg"
            onCloseAutoFocus={(event) => {
              // The portal can finish closing after a resize has hidden its trigger.
              if (!compactMode.current) {
                event.preventDefault();
                container.current
                  ?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
                  ?.focus();
              }
            }}
          >
            {items.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className="min-h-11 rounded-md pl-3 pr-9 focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
              >
                {item.label}
                {item.badge !== undefined ? ` (${item.badge})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div hidden={compact}>
        <TabsList aria-label={`${label}s`} className={cn('w-full', listClass)}>
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={cn('flex-1', triggerClass)}
            >
              <ItemLabel item={item} />
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
