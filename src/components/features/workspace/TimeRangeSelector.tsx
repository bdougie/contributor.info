import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Lock, Calendar } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

export interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  availableRanges?: TimeRange[];
  tier?: 'free' | 'pro' | 'enterprise';
  onUpgradeClick?: () => void;
  className?: string;
  variant?: 'select' | 'buttons';
  disabled?: boolean;
}

const timeRangeLabels: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y': 'Last year',
  'all': 'All time',
};

const timeRangeTiers: Record<TimeRange, 'free' | 'pro' | 'enterprise'> = {
  '7d': 'free',
  '30d': 'free',
  '90d': 'pro',
  '1y': 'pro',
  'all': 'enterprise',
};

export function TimeRangeSelector({
  value,
  onChange,
  availableRanges = ['7d', '30d', '90d', '1y', 'all'],
  tier = 'free',
  onUpgradeClick,
  className,
  variant = 'select',
  disabled = false,
}: TimeRangeSelectorProps) {
  const isRangeAvailable = (range: TimeRange) => {
    const requiredTier = timeRangeTiers[range];
    if (tier === 'enterprise') return true;
    if (tier === 'pro') return requiredTier !== 'enterprise';
    return requiredTier === 'free';
  };

  const handleRangeSelect = (range: TimeRange) => {
    if (isRangeAvailable(range)) {
      onChange(range);
    } else if (onUpgradeClick) {
      onUpgradeClick();
    }
  };

  if (variant === 'buttons') {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {availableRanges.map((range) => {
          const available = isRangeAvailable(range);
          const isSelected = value === range;

          const button = (
            <Button
              key={range}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleRangeSelect(range)}
              disabled={disabled || !available}
              className={cn(
                "min-w-[80px]",
                !available && "opacity-60"
              )}
            >
              <span className="flex items-center gap-1">
                {timeRangeLabels[range]}
                {!available && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 ml-1" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This feature requires an upgrade</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            </Button>
          );

          if (!available && onUpgradeClick) {
            return (
              <TooltipProvider key={range}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-semibold mb-1">
                        {timeRangeTiers[range] === 'pro' ? 'Pro' : 'Enterprise'} feature
                      </p>
                      <p>Upgrade to access {timeRangeLabels[range].toLowerCase()} data</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return button;
        })}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(val) => handleRangeSelect(val as TimeRange)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-[180px]", className)}>
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select time range" />
      </SelectTrigger>
      <SelectContent>
        {availableRanges.map((range) => {
          const available = isRangeAvailable(range);
          const requiredTier = timeRangeTiers[range];

          return (
            <SelectItem
              key={range}
              value={range}
              disabled={!available}
              className={cn(
                !available && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span>{timeRangeLabels[range]}</span>
                {!available && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {requiredTier === 'pro' ? 'Pro' : 'Enterprise'}
                  </Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
        {tier === 'free' && onUpgradeClick && (
          <>
            <div className="my-1 border-t" />
            <button
              onClick={(e) => {
                e.preventDefault();
                onUpgradeClick();
              }}
              className="flex w-full items-center px-2 py-1.5 text-sm text-primary hover:bg-accent rounded-sm cursor-pointer"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center">
                      <Lock className="h-3 w-3 mr-2" />
                      Upgrade for more data
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This feature requires an upgrade</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </button>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// Quick preset buttons for common use cases
export function TimeRangeQuickSelect({
  value,
  onChange,
  tier = 'free',
  onUpgradeClick,
  className,
}: Omit<TimeRangeSelectorProps, 'variant' | 'availableRanges'>) {
  const quickRanges: TimeRange[] = ['7d', '30d', '90d'];
  
  return (
    <TimeRangeSelector
      value={value}
      onChange={onChange}
      availableRanges={quickRanges}
      tier={tier}
      onUpgradeClick={onUpgradeClick}
      variant="buttons"
      className={className}
    />
  );
}