import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Represents a single sub-tab configuration
 */
export interface SubTab {
  /** Unique identifier for the tab */
  value: string;
  /** Display label for the tab */
  label: string;
  /** Optional count to display in a badge */
  count?: number;
  /** Optional icon to display next to label */
  icon?: React.ReactNode;
  /** Optional disabled state */
  disabled?: boolean;
}

/**
 * Props for WorkspaceSubTabs component
 */
export interface WorkspaceSubTabsProps {
  /** Array of tab configurations */
  tabs: SubTab[];
  /** Currently active tab value */
  activeTab: string;
  /** Callback when tab changes - receives the new tab value */
  onTabChange: (value: string) => void;
  /** Optional CSS class name */
  className?: string;
  /** Optional map of tab values to content components */
  children?: Record<string, React.ReactNode>;
}

/**
 * WorkspaceSubTabs Component
 *
 * Reusable tabbed interface for filtering within workspace sections.
 * Used for "Needs Response" / "Replies" tabs and similar filters.
 *
 * @example
 * ```tsx
 * <WorkspaceSubTabs
 *   tabs={[
 *     { value: 'needs_response', label: 'Needs Response', count: 5 },
 *     { value: 'replied', label: 'Replies', count: 2 }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * ```
 */
export function WorkspaceSubTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  children,
}: WorkspaceSubTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className={cn('w-full', className)}>
      <TabsList className="inline-flex bg-muted rounded-lg p-1">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tab.count}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Render tab content if provided */}
      {children &&
        tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {children[tab.value]}
          </TabsContent>
        ))}
    </Tabs>
  );
}
