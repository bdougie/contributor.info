import * as React from 'react';
import { Search, X } from '@/components/ui/icon';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
  wrapperClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, value, onClear, onChange, ...props }, ref) => {
    const showClearButton = value && String(value).length > 0;

    return (
      <div className={cn('relative', wrapperClassName)}>
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          {...props}
          value={value}
          onChange={onChange}
          className={cn('pl-10 pr-10 w-full', className)}
          ref={ref}
        />
        {showClearButton && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClear}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };
