import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface CommandPaletteSkeletonProps {
  open?: boolean;
}

export function CommandPaletteSkeleton({ open = false }: CommandPaletteSkeletonProps) {
  return (
    <CommandDialog open={open}>
      <CommandInput placeholder="Search repositories and workspaces..." />
      <CommandList>
        <CommandEmpty>Loading...</CommandEmpty>
        <CommandGroup heading="Recent">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommandItem key={i} className="cursor-pointer">
              <div className="flex items-center gap-3 w-full">
                <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted animate-pulse rounded w-32" />
                  <div className="h-2 bg-muted animate-pulse rounded w-48" />
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Repositories">
          {Array.from({ length: 4 }).map((_, i) => (
            <CommandItem key={i} className="cursor-pointer">
              <div className="flex items-center gap-3 w-full">
                <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted animate-pulse rounded w-40" />
                  <div className="h-2 bg-muted animate-pulse rounded w-56" />
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}