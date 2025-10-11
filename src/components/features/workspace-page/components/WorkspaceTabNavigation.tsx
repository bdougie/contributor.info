import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitPullRequest,
  AlertCircle,
  Users,
  Layout,
  Settings,
  Activity,
  MessageSquare,
} from '@/components/ui/icon';

export function WorkspaceTabNavigation() {
  return (
    <TabsList className="grid w-full grid-cols-4 grid-rows-2 sm:flex sm:w-full sm:justify-between sm:grid-rows-1 mb-6 min-h-[88px] sm:min-h-[44px]">
      <TabsTrigger value="overview" className="flex items-center gap-2 sm:pl-4">
        <Layout className="h-4 w-4" />
        <span className="hidden sm:inline">Overview</span>
      </TabsTrigger>
      <TabsTrigger value="prs" className="flex items-center gap-2">
        <GitPullRequest className="h-4 w-4" />
        <span className="hidden sm:inline">PRs</span>
      </TabsTrigger>
      <TabsTrigger value="issues" className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Issues</span>
      </TabsTrigger>
      <TabsTrigger value="discussions" className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Discussions</span>
      </TabsTrigger>
      <TabsTrigger value="contributors" className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">Contributors</span>
      </TabsTrigger>
      <TabsTrigger value="activity" className="flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <span className="hidden sm:inline">Activity</span>
      </TabsTrigger>
      <TabsTrigger value="settings" className="flex items-center gap-2 sm:pr-4">
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Settings</span>
      </TabsTrigger>
    </TabsList>
  );
}
