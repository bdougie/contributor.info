import type { HTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

function Card({ className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-card text-card-foreground shadow', className)}
      {...props}
    />
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

function CardHeader({ className, ref, ...props }: CardHeaderProps) {
  return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  ref?: Ref<HTMLHeadingElement>;
}

function CardTitle({ className, ref, ...props }: CardTitleProps) {
  return (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: Ref<HTMLParagraphElement>;
}

function CardDescription({ className, ref, ...props }: CardDescriptionProps) {
  return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

function CardContent({ className, ref, ...props }: CardContentProps) {
  return <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

function CardFooter({ className, ref, ...props }: CardFooterProps) {
  return <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
