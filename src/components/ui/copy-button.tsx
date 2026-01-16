import { useState, useEffect } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Copy, Check } from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CopyButtonProps extends ButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  iconClassName?: string;
}

export function CopyButton({
  value,
  label = 'Copy to clipboard',
  successMessage = 'Copied to clipboard',
  className,
  iconClassName,
  variant = 'ghost',
  size = 'icon',
  onClick,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (hasCopied) {
      const timeout = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [hasCopied]);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call original onClick if provided
    onClick?.(e);

    try {
      await navigator.clipboard.writeText(value);
      setHasCopied(true);
      toast({
        title: 'Copied',
        description: successMessage,
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={handleCopy}
      aria-label={hasCopied ? 'Copied' : label}
      {...props}
    >
      {hasCopied ? (
        <Check className={cn('h-4 w-4', iconClassName)} />
      ) : (
        <Copy className={cn('h-4 w-4', iconClassName)} />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
