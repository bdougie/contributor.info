import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Layout as LayoutDashboard, 
  Circle as CircleDot, 
  GitPullRequest, 
  Users, 
  Settings,
  Activity,
  TrendingUp
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type TabValue = 'overview' | 'issues' | 'pull-requests' | 'contributors' | 'activity' | 'settings';

export interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

export interface WorkspaceTabNavigationProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  tabs?: TabConfig[];
  className?: string;
  children?: React.ReactNode;
  showCounts?: {
    issues?: number;
    pullRequests?: number;
    contributors?: number;
  };
}

const defaultTabs: TabConfig[] = [
  {
    value: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    value: 'issues',
    label: 'Issues',
    icon: <CircleDot className="h-4 w-4" />,
  },
  {
    value: 'pull-requests',
    label: 'Pull Requests',
    icon: <GitPullRequest className="h-4 w-4" />,
  },
  {
    value: 'contributors',
    label: 'Contributors',
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: 'activity',
    label: 'Activity',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    value: 'settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function WorkspaceTabNavigation({
  activeTab,
  onTabChange,
  tabs = defaultTabs,
  className,
  children,
  showCounts,
}: WorkspaceTabNavigationProps) {
  // Add counts to tabs if provided
  const tabsWithCounts = tabs.map(tab => {
    if (showCounts) {
      if (tab.value === 'issues' && showCounts.issues !== undefined) {
        return { ...tab, badge: showCounts.issues };
      }
      if (tab.value === 'pull-requests' && showCounts.pullRequests !== undefined) {
        return { ...tab, badge: showCounts.pullRequests };
      }
      if (tab.value === 'contributors' && showCounts.contributors !== undefined) {
        return { ...tab, badge: showCounts.contributors };
      }
    }
    return tab;
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as TabValue)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
        {tabsWithCounts.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="flex items-center gap-2 data-[state=active]:bg-background"
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge 
                variant="secondary" 
                className="ml-1.5 h-5 px-1.5 text-xs"
              >
                {typeof tab.badge === 'number' && tab.badge > 99 
                  ? '99+' 
                  : tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {children && (
        <div className="mt-6">
          {children}
        </div>
      )}
    </Tabs>
  );
}

// Individual tab content components for convenience
export function OverviewTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="overview">{children}</TabsContent>;
}

export function IssuesTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="issues">{children}</TabsContent>;
}

export function PullRequestsTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="pull-requests">{children}</TabsContent>;
}

export function ContributorsTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="contributors">{children}</TabsContent>;
}

export function ActivityTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="activity">{children}</TabsContent>;
}

export function SettingsTab({ children }: { children: React.ReactNode }) {
  return <TabsContent value="settings">{children}</TabsContent>;
}

// Compact mobile-optimized version
export function WorkspaceTabNavigationMobile({
  activeTab,
  onTabChange,
  showCounts,
  className,
}: Omit<WorkspaceTabNavigationProps, 'tabs' | 'children'>) {
  const mobileTabs: TabConfig[] = [
    {
      value: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      value: 'issues',
      label: 'Issues',
      icon: <CircleDot className="h-5 w-5" />,
      badge: showCounts?.issues,
    },
    {
      value: 'pull-requests',
      label: 'PRs',
      icon: <GitPullRequest className="h-5 w-5" />,
      badge: showCounts?.pullRequests,
    },
    {
      value: 'contributors',
      label: 'Team',
      icon: <Users className="h-5 w-5" />,
      badge: showCounts?.contributors,
    },
  ];

  return (
    <div className={cn("flex justify-around border-b", className)}>
      {mobileTabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-2 text-sm transition-colors relative",
            activeTab === tab.value
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="relative">
            {tab.icon}
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {tab.badge > 9 ? '9+' : tab.badge}
              </Badge>
            )}
          </div>
          <span className="text-xs">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// Tab with custom content support
export function WorkspaceTabWithContent({
  activeTab,
  onTabChange,
  tabs = defaultTabs,
  className,
  showCounts,
  children,
}: WorkspaceTabNavigationProps & {
  children: Record<TabValue, React.ReactNode>;
}) {
  const tabsWithCounts = tabs.map(tab => {
    if (showCounts) {
      if (tab.value === 'issues' && showCounts.issues !== undefined) {
        return { ...tab, badge: showCounts.issues };
      }
      if (tab.value === 'pull-requests' && showCounts.pullRequests !== undefined) {
        return { ...tab, badge: showCounts.pullRequests };
      }
      if (tab.value === 'contributors' && showCounts.contributors !== undefined) {
        return { ...tab, badge: showCounts.contributors };
      }
    }
    return tab;
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as TabValue)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
        {tabsWithCounts.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="flex items-center gap-2"
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge 
                variant="secondary" 
                className="ml-1.5 h-5 px-1.5 text-xs"
              >
                {typeof tab.badge === 'number' && tab.badge > 99 
                  ? '99+' 
                  : tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-6">
          {children[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}