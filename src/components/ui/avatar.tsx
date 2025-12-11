import type { ComponentPropsWithoutRef, ElementRef, Ref } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

export interface AvatarProps extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  ref?: Ref<ElementRef<typeof AvatarPrimitive.Root>>;
}

function Avatar({ className, ref, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

export interface AvatarImageProps extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  loading?: 'lazy' | 'eager';
  width?: number;
  height?: number;
  ref?: Ref<ElementRef<typeof AvatarPrimitive.Image>>;
}

function AvatarImage({
  className,
  loading = 'lazy',
  width,
  height,
  ref,
  ...props
}: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('aspect-square h-full w-full', className)}
      loading={loading}
      width={width}
      height={height}
      {...props}
    />
  );
}

export interface AvatarFallbackProps
  extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  ref?: Ref<ElementRef<typeof AvatarPrimitive.Fallback>>;
}

function AvatarFallback({ className, ref, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
