import { SectionNavigation } from '@/components/ui/section-navigation';
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

const sections = [
  { value: 'overview', label: 'Overview', icon: <Layout /> },
  { value: 'prs', label: 'PRs', icon: <GitPullRequest /> },
  { value: 'issues', label: 'Issues', icon: <AlertCircle /> },
  { value: 'discussions', label: 'Discussions', icon: <MessageSquare /> },
  { value: 'spam', label: 'Spam', icon: <Shield /> },
  { value: 'contributors', label: 'Contributors', icon: <Users /> },
  { value: 'activity', label: 'Activity', icon: <Activity /> },
  { value: 'settings', label: 'Settings', icon: <Settings /> },
];

export function WorkspaceTabNavigation({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <SectionNavigation
      label="Workspace section"
      items={sections}
      value={value}
      onValueChange={onValueChange}
      className="mb-6"
    />
  );
}
