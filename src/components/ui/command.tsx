import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes, Ref } from 'react';
import { Search } from '@/components/ui/icon';
import { type DialogProps } from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface CommandProps extends ComponentPropsWithoutRef<typeof CommandPrimitive> {
  ref?: Ref<ElementRef<typeof CommandPrimitive>>;
}

function Command({ className, ref, ...props }: CommandProps) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
        className
      )}
      {...props}
    />
  );
}

type CommandDialogProps = DialogProps;

function CommandDialog({ children, ...props }: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export interface CommandInputProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.Input> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.Input>>;
}

function CommandInput({ className, ref, ...props }: CommandInputProps) {
  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
}

export interface CommandListProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.List> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.List>>;
}

function CommandList({ className, ref, ...props }: CommandListProps) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
      {...props}
    />
  );
}

export interface CommandEmptyProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.Empty>>;
}

function CommandEmpty({ ref, ...props }: CommandEmptyProps) {
  return <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />;
}

export interface CommandGroupProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.Group> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.Group>>;
}

function CommandGroup({ className, ref, ...props }: CommandGroupProps) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn(
        'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export interface CommandSeparatorProps extends ComponentPropsWithoutRef<
  typeof CommandPrimitive.Separator
> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.Separator>>;
}

function CommandSeparator({ className, ref, ...props }: CommandSeparatorProps) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export interface CommandItemProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  ref?: Ref<ElementRef<typeof CommandPrimitive.Item>>;
}

function CommandItem({ className, ref, ...props }: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
