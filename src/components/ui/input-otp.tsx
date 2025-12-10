import { useContext, type ComponentPropsWithoutRef, type ElementRef, type Ref } from 'react';
import { Minus } from '@/components/ui/icon';
import { OTPInput, OTPInputContext } from 'input-otp';

import { cn } from '@/lib/utils';

export type InputOTPProps = ComponentPropsWithoutRef<typeof OTPInput> & {
  ref?: Ref<ElementRef<typeof OTPInput>>;
};

function InputOTP({ className, containerClassName, ref, ...props }: InputOTPProps) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn(
        'flex items-center gap-2 has-[:disabled]:opacity-50',
        containerClassName
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

export interface InputOTPGroupProps extends ComponentPropsWithoutRef<'div'> {
  ref?: Ref<HTMLDivElement>;
}

function InputOTPGroup({ className, ref, ...props }: InputOTPGroupProps) {
  return <div ref={ref} className={cn('flex items-center', className)} {...props} />;
}

export interface InputOTPSlotProps extends ComponentPropsWithoutRef<'div'> {
  ref?: Ref<HTMLDivElement>;
  index: number;
}

function InputOTPSlot({ index, className, ref, ...props }: InputOTPSlotProps) {
  const inputOTPContext = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'z-10 ring-1 ring-ring',
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

export interface InputOTPSeparatorProps extends ComponentPropsWithoutRef<'div'> {
  ref?: Ref<HTMLDivElement>;
}

function InputOTPSeparator({ ref, ...props }: InputOTPSeparatorProps) {
  return (
    <div ref={ref} role="separator" {...props}>
      <Minus />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
