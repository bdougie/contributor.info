import type { HTMLAttributes, Ref, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  ref?: Ref<HTMLTableElement>;
}

function Table({ className, ref, ...props }: TableProps) {
  return (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  ref?: Ref<HTMLTableSectionElement>;
}

function TableHeader({ className, ref, ...props }: TableHeaderProps) {
  return <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />;
}

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  ref?: Ref<HTMLTableSectionElement>;
}

function TableBody({ className, ref, ...props }: TableBodyProps) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {
  ref?: Ref<HTMLTableSectionElement>;
}

function TableFooter({ className, ref, ...props }: TableFooterProps) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  ref?: Ref<HTMLTableRowElement>;
}

function TableRow({ className, ref, ...props }: TableRowProps) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  ref?: Ref<HTMLTableCellElement>;
}

function TableHead({ className, ref, ...props }: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  ref?: Ref<HTMLTableCellElement>;
}

function TableCell({ className, ref, ...props }: TableCellProps) {
  return (
    <td
      ref={ref}
      className={cn(
        'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  ref?: Ref<HTMLTableCaptionElement>;
}

function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
