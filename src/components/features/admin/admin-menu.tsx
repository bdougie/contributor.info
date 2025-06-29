import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Users, 
  Activity,
  Monitor,
  BarChart3,
  Database,
  Settings,
  FileText,
  AlertTriangle,
  Key
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";

interface AdminRoute {
  path: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "users" | "system" | "analytics" | "tools";
  badge?: string;
}

const adminRoutes: AdminRoute[] = [
  {
    path: "/admin/users",
    title: "User Management",
    description: "Manage application users, roles, and permissions",
    icon: <Users className="h-4 w-4" />,
    category: "users"
  },
  {
    path: "/admin/analytics",
    title: "Analytics Dashboard",
    description: "View social sharing metrics, popular repositories, and user engagement data",
    icon: <BarChart3 className="h-4 w-4" />,
    category: "analytics"
  },
  {
    path: "/admin/performance-monitoring",
    title: "Performance Monitoring",
    description: "Real-time database performance, GitHub API metrics, and system health monitoring",
    icon: <Monitor className="h-4 w-4" />,
    category: "system"
  },
  {
    path: "/admin/bulk-add-repos",
    title: "Repository Management",
    description: "Add multiple repositories to tracking list and manage repository settings",
    icon: <Database className="h-4 w-4" />,
    category: "tools"
  },
  {
    path: "/admin/system-config",
    title: "System Configuration",
    description: "Configure application settings, API limits, and system parameters",
    icon: <Settings className="h-4 w-4" />,
    category: "system",
    badge: "Coming Soon"
  },
  {
    path: "/admin/audit-logs",
    title: "Audit Logs",
    description: "View system audit logs and administrative action history",
    icon: <FileText className="h-4 w-4" />,
    category: "system",
    badge: "Coming Soon"
  }
];

const categoryColors = {
  users: "bg-blue-100 text-blue-800",
  system: "bg-red-100 text-red-800",
  analytics: "bg-green-100 text-green-800",
  tools: "bg-purple-100 text-purple-800"
};

const categoryIcons = {
  users: <Users className="h-4 w-4" />,
  system: <AlertTriangle className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  tools: <Settings className="h-4 w-4" />
};

export function AdminMenu() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAdminAuth();

  const groupedRoutes = adminRoutes.reduce((acc, route) => {
    if (!acc[route.category]) {
      acc[route.category] = [];
    }
    acc[route.category].push(route);
    return acc;
  }, {} as Record<string, AdminRoute[]>);

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span>Logged in as: <strong>{user?.user_metadata?.user_name}</strong></span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Administrator
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(groupedRoutes).map(([category, routes]) => (
            <Card key={category} className="flex flex-col h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  {categoryIcons[category as keyof typeof categoryIcons]}
                  <span className="capitalize">{category}</span>
                  <Badge className={categoryColors[category as keyof typeof categoryColors]}>
                    {routes.length} {routes.length === 1 ? 'tool' : 'tools'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                {routes.map((route) => (
                  <div key={route.path}>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-4 px-4 text-left"
                      onClick={() => navigate(route.path)}
                      disabled={!!route.badge}
                    >
                      <div className="flex-shrink-0">
                        {route.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{route.title}</span>
                          {route.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {route.badge}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground leading-relaxed break-words text-wrap">
                          {route.description}
                        </div>
                      </div>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dev")}
            >
              Developer Tools
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              Return to Site
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Refresh Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}