import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitPullRequest,
  AlertCircle,
  Users,
  Layout,
  Settings,
  Activity,
  MessageSquare,
  Shield,
} from '@/components/ui/icon';

export function WorkspaceTabNavigation() {
  const triggerClassName =
    'flex min-h-11 min-w-0 items-center gap-2 px-2 text-xs sm:text-sm [&>svg]:shrink-0';
  return (
    <TabsList
      aria-label="Workspace sections"
      className="mb-6 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8"
    >
      <TabsTrigger value="overview" className={triggerClassName}>
        <Layout className="h-4 w-4" />
        <span className="truncate">Overview</span>
      </TabsTrigger>
      <TabsTrigger value="prs" className={triggerClassName}>
        <GitPullRequest className="h-4 w-4" />
        <span className="truncate">PRs</span>
      </TabsTrigger>
      <TabsTrigger value="issues" className={triggerClassName}>
        <AlertCircle className="h-4 w-4" />
        <span className="truncate">Issues</span>
      </TabsTrigger>
      <TabsTrigger value="discussions" className={triggerClassName}>
        <MessageSquare className="h-4 w-4" />
        <span className="truncate">Discussions</span>
      </TabsTrigger>
      <TabsTrigger value="spam" className={triggerClassName}>
        <Shield className="h-4 w-4" />
        <span className="truncate">Spam</span>
      </TabsTrigger>
      <TabsTrigger value="contributors" className={triggerClassName}>
        <Users className="h-4 w-4" />
        <span className="truncate">Contributors</span>
      </TabsTrigger>
      <TabsTrigger value="activity" className={triggerClassName}>
        <Activity className="h-4 w-4" />
        <span className="truncate">Activity</span>
      </TabsTrigger>
      <TabsTrigger value="settings" className={triggerClassName}>
        <Settings className="h-4 w-4" />
        <span className="truncate">Settings</span>
      </TabsTrigger>
    </TabsList>
  );
}
