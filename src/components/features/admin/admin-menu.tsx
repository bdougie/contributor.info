import { 
  Shield, 
  Users, 
  BarChart3, 
  Activity, 
  GitBranch, 
  AlertTriangle,
  Settings,
  Database,
  FileText,
  TrendingUp,
  Bug
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/use-admin-auth';

interface AdminMenuItemProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  variant?: 'default' | 'warning' | 'success';
}

function AdminMenuItem({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  badge, 
  variant = 'default' 
}: AdminMenuItemProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              variant === 'warning' ? 'bg-amber-100 text-amber-600' :
              variant === 'success' ? 'bg-green-100 text-green-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {badge && (
            <Badge variant={variant === 'warning' ? 'destructive' : 'secondary'}>
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        <Button asChild className="w-full">
          <Link to={href}>
            Open {title}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AdminMenu() {
  const { user } = useAdminAuth();

  const adminTools = [
    {
      title: 'User Management',
      description: 'Manage user accounts, roles, and permissions. View user activity and moderate accounts.',
      icon: Users,
      href: '/admin/users',
      badge: 'Core'
    },
    {
      title: 'Spam Management',
      description: 'Review flagged PRs, adjust spam detection settings, and manage false positives.',
      icon: AlertTriangle,
      href: '/admin/spam',
      badge: 'Phase 4',
      variant: 'warning' as const
    },
    {
      title: 'Spam Test Tool',
      description: 'Test spam detection on individual PRs and provide manual feedback for training.',
      icon: Bug,
      href: '/admin/spam-test',
      badge: 'Debug',
      variant: 'default' as const
    },
    {
      title: 'Bulk Spam Analysis',
      description: 'Analyze previous PRs across all repositories for spam detection. Process unanalyzed PRs in bulk.',
      icon: BarChart3,
      href: '/admin/bulk-spam-analysis',
      badge: 'New',
      variant: 'success' as const
    },
    {
      title: 'Analytics Dashboard',
      description: 'System-wide analytics, user metrics, and performance insights for administrators.',
      icon: BarChart3,
      href: '/admin/analytics'
    },
    {
      title: 'Performance Monitoring',
      description: 'Monitor system performance, database queries, and application health metrics.',
      icon: Activity,
      href: '/admin/performance-monitoring'
    },
    {
      title: 'Repository Management',
      description: 'Bulk repository operations, sync management, and data integrity tools.',
      icon: GitBranch,
      href: '/admin/bulk-add-repos'
    },
    {
      title: 'System Configuration',
      description: 'Application settings, feature flags, and system-wide configuration options.',
      icon: Settings,
      href: '/admin/settings',
      badge: 'Future'
    },
    {
      title: 'Database Tools',
      description: 'Direct database access, query tools, and data management utilities.',
      icon: Database,
      href: '/admin/database',
      badge: 'Future'
    },
    {
      title: 'Audit Logs',
      description: 'View administrative actions, user activity logs, and system events.',
      icon: FileText,
      href: '/admin/audit-logs',
      badge: 'Future'
    }
  ];

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Administrative tools and system management
            </p>
          </div>
        </div>
        
        {/* Admin Info */}
        {user && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                <Shield className="h-3 w-3 mr-1" />
                Administrator
              </Badge>
              <span className="text-sm text-muted-foreground">
                Logged in as <strong>{user.github_username}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Last login: {new Date(user.last_login_at).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {/* Admin Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminTools.map((tool) => (
          <AdminMenuItem
            key={tool.href}
            title={tool.title}
            description={tool.description}
            icon={tool.icon}
            href={tool.href}
            badge={tool.badge}
            variant={tool.variant}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/users?filter=recent">Recent Users</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/spam?status=pending">Pending Reviews</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/bulk-spam-analysis?filter=pending">Analyze Pending PRs</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/analytics?view=today">Today's Metrics</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dev">Dev Tools</Link>
          </Button>
        </div>
      </div>

      {/* System Status */}
      <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 text-green-800">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="font-medium">System Status: Operational</span>
        </div>
        <p className="text-green-700 text-sm mt-1">
          All systems are running normally. Database connected, authentication active.
        </p>
      </div>
    </div>
  );
}