import { Badge } from "@/components/ui/badge";
import { RepositorySize } from "@/lib/validation/database-schemas";
import { cn } from "@/lib/utils";

interface RepositorySizeBadgeProps {
  size?: RepositorySize;
  className?: string;
}

const sizeConfig = {
  small: {
    label: "S",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    tooltip: "Small repository (< 1k stars, < 100 PRs/month)"
  },
  medium: {
    label: "M", 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    tooltip: "Medium repository (1k-10k stars, 100-500 PRs/month)"
  },
  large: {
    label: "L",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300", 
    tooltip: "Large repository (10k-50k stars, 500-2k PRs/month)"
  },
  xl: {
    label: "XL",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    tooltip: "Extra large repository (>50k stars, >2k PRs/month)"
  }
} as const;

export function RepositorySizeBadge({ size, className }: RepositorySizeBadgeProps) {
  if (!size) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("text-xs font-medium", className)}
        title="Repository size not yet classified"
      >
        ?
      </Badge>
    );
  }

  const config = sizeConfig[size];

  return (
    <Badge 
      className={cn(
        "text-xs font-medium border-0",
        config.color,
        className
      )}
      title={config.tooltip}
    >
      {config.label}
    </Badge>
  );
}