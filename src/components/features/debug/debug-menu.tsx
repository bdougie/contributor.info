import { Bug, Key, TestTube, Palette, Activity, FileText, Globe, Image, Link, GitBranch } from '@/components/ui/icon';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DebugRoute {
  path: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "auth" | "testing" | "dev" | "insights" | "docs" | "monitoring";
}

const debugRoutes: DebugRoute[] = [
  {
    path: "/dev/debug-auth",
    title: "Authentication Debug",
    description: "Debug authentication issues, view session details, and test OAuth flow",
    icon: <Key className="h-4 w-4" />,
    category: "auth"
  },
  {
    path: "/dev/test-insights",
    title: "Test Insights",
    description: "Test insights functionality and data processing",
    icon: <TestTube className="h-4 w-4" />,
    category: "testing"
  },
  {
    path: "/dev/social-cards",
    title: "Social Card Preview",
    description: "Preview and test social media card generation",
    icon: <Palette className="h-4 w-4" />,
    category: "dev"
  },
  {
    path: "/dev/shareable-charts",
    title: "Shareable Charts Preview",
    description: "Test shareable charts with different types and attribution bars",
    icon: <Image className="h-4 w-4" />,
    category: "dev"
  },
  {
    path: "/dev/dub-test",
    title: "Dub.co API Test",
    description: "Test dub.co API integration and debug authorization issues",
    icon: <Link className="h-4 w-4" />,
    category: "testing"
  },
  {
    path: "/dev/sync-test",
    title: "GitHub Sync Test",
    description: "Manual GitHub sync testing with real-time logging and debugging",
    icon: <GitBranch className="h-4 w-4" />,
    category: "testing"
  },
  {
    path: "/changelog",
    title: "Changelog",
    description: "View application changelog and version history",
    icon: <FileText className="h-4 w-4" />,
    category: "docs"
  },
  {
    path: "/docs",
    title: "Documentation",
    description: "Application documentation and API references",
    icon: <Globe className="h-4 w-4" />,
    category: "docs"
  }
];

const categoryColors = {
  auth: "bg-blue-100 text-blue-800",
  testing: "bg-green-100 text-green-800",
  dev: "bg-purple-100 text-purple-800",
  insights: "bg-orange-100 text-orange-800",
  docs: "bg-gray-100 text-gray-800",
  monitoring: "bg-red-100 text-red-800"
};

export function DebugMenu() {
  const navigate = useNavigate();

  const groupedRoutes = debugRoutes.reduce((acc, route) => {
    if (!acc[route.category]) {
      acc[route.category] = [];
    }
    acc[route.category].push(route);
    return acc;
  }, {} as Record<string, DebugRoute[]>);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
            <Bug className="h-8 w-8" />
            Debug Menu
          </h1>
          <p className="text-muted-foreground">
            Public development tools and social media previews. For admin tools like analytics, performance monitoring, and bulk operations, visit <a href="/admin" className="text-blue-600 hover:underline">/admin</a>.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(groupedRoutes).map(([category, routes]) => (
            <Card key={category} className="flex flex-col h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Badge className={categoryColors[category as keyof typeof categoryColors]}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {routes.map((route) => (
                  <div key={route.path}>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3 px-3 text-left"
                      onClick={() => navigate(route.path)}
                    >
                      <div className="flex-shrink-0">
                        {route.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm mb-1">{route.title}</div>
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

        <div className="mt-8 p-6 bg-muted rounded-lg text-center">
          <h3 className="font-semibold mb-4 flex items-center justify-center gap-2">
            <Activity className="h-4 w-4" />
            Quick Actions
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="min-w-0"
            >
              Reload Page
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => localStorage.clear()}
              className="min-w-0"
            >
              Clear LocalStorage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sessionStorage.clear()}
              className="min-w-0"
            >
              Clear SessionStorage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}