/**
 * Production wrapper for ContributorEmptyState
 * This connects the simple component with actual UI libraries
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContributorEmptyStateSimple } from "./contributor-empty-state-simple";
import type { EmptyStateType } from "@/lib/contributor-empty-state-config";

// Icon map for production
const iconMap = {
  trophy: Trophy,
  users: Users,
  calendar: Calendar,
  "trending-up": TrendingUp,
};

interface EmptyStateProps {
  type: EmptyStateType;
  message?: string;
  suggestion?: string;
  className?: string;
}

/**
 * Production component that wraps the simple version with actual UI components
 */
export function ContributorEmptyState({
  type,
  message,
  suggestion,
  className,
}: EmptyStateProps) {
  // Icon renderer that uses actual lucide-react icons
  const renderIcon = (iconName: string, iconColor: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Users;
    return <IconComponent className={cn("h-16 w-16", iconColor)} aria-hidden="true" />;
  };

  // For now, we can still use the simple version with custom rendering
  // Or we can keep the original implementation here
  // The key is that tests use the simple version
  return (
    <ContributorEmptyStateSimple
      type={type}
      message={message}
      suggestion={suggestion}
      className={className}
      renderIcon={renderIcon}
    />
  );
}

// Export the simple version for testing
export { ContributorEmptyStateSimple };