import type {
  AnchorHTMLAttributes,
  ComponentProps,
  ComponentPropsWithoutRef,
  LiHTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import { ChevronRight, MoreHorizontal } from '@/components/ui/icon';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

export interface BreadcrumbProps extends ComponentPropsWithoutRef<'nav'> {
  ref?: Ref<HTMLElement>;
  separator?: ReactNode;
}

function Breadcrumb({ ref, ...props }: BreadcrumbProps) {
  return <nav ref={ref} aria-label="breadcrumb" {...props} />;
}

export interface BreadcrumbListProps extends ComponentPropsWithoutRef<'ol'> {
  ref?: Ref<HTMLOListElement>;
}

function BreadcrumbList({ className, ref, ...props }: BreadcrumbListProps) {
  return (
    <ol
      ref={ref}
      className={cn(
        'flex flex-wrap items-center gap-1 break-words text-xs text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export interface BreadcrumbItemProps extends LiHTMLAttributes<HTMLLIElement> {
  ref?: Ref<HTMLLIElement>;
}

function BreadcrumbItem({ className, ref, ...props }: BreadcrumbItemProps) {
  return <li ref={ref} className={cn('inline-flex items-center gap-1', className)} {...props} />;
}

export interface BreadcrumbLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ref?: Ref<HTMLAnchorElement>;
  asChild?: boolean;
}

function BreadcrumbLink({ asChild, className, ref, ...props }: BreadcrumbLinkProps) {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      ref={ref}
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  );
}

export interface BreadcrumbPageProps extends ComponentPropsWithoutRef<'span'> {
  ref?: Ref<HTMLSpanElement>;
}

function BreadcrumbPage({ className, ref, ...props }: BreadcrumbPageProps) {
  return (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3 opacity-50', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
