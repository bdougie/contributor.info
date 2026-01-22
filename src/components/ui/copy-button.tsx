import { useState, useEffect } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Copy, Check } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CopyButtonProps extends ButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  iconClassName?: string;
  icon?: React.ElementType;
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
  icon: Icon = Copy,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);

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
      toast.success('Copied', {
        description: successMessage,
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error('Error', {
        description: 'Failed to copy to clipboard',
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
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
              <Icon className={cn('h-4 w-4', iconClassName)} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hasCopied ? 'Copied!' : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
