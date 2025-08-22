import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Search,
  Settings,
  User,
  Home,
  FolderOpen,
  Users,
  BarChart3,
  GitPullRequest,
  GitCommit,
  Star,
  TrendingUp,
  Activity,
  Clock,
  Calendar,
  MoreVertical,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const meta = {
  title: "Composite/Page Layouts",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Complete page layout patterns for different application views.",
      },
    },
  },
  tags: ["autodocs", "composite", "layouts"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Dashboard Layout
const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const stats = [
    { label: "Total Repositories", value: "24", change: "+12%", icon: FolderOpen },
    { label: "Active Contributors", value: "142", change: "+8%", icon: Users },
    { label: "Pull Requests", value: "89", change: "+23%", icon: GitPullRequest },
    { label: "Code Reviews", value: "156", change: "-5%", icon: GitCommit },
  ];

  const recentActivity = [
    { user: "Alice", action: "opened PR", repo: "frontend", time: "2 hours ago" },
    { user: "Bob", action: "merged PR", repo: "backend", time: "3 hours ago" },
    { user: "Carol", action: "reviewed PR", repo: "docs", time: "5 hours ago" },
    { user: "Dave", action: "committed to", repo: "api", time: "6 hours ago" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                className="pl-10 w-[300px]"
              />
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } bg-white border-r transition-all duration-300 overflow-hidden`}
        >
          <nav className="p-4 space-y-2">
            <a
              href="#"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-700"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <FolderOpen className="h-5 w-5" />
              <span>Repositories</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <Users className="h-5 w-5" />
              <span>Contributors</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Analytics</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.label}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      <span
                        className={
                          stat.change.startsWith("+")
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {stat.change}
                      </span>{" "}
                      from last month
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Feed */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest updates from your repositories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {activity.user.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user}</span>{" "}
                          {activity.action}{" "}
                          <span className="font-medium">{activity.repo}</span>
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Contributors */}
            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>This month's most active</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {["Alice", "Bob", "Carol", "Dave", "Eve"].map((name, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-gray-500">
                          {Math.floor(Math.random() * 50 + 10)} contributions
                        </p>
                      </div>
                      <Badge variant={index === 0 ? "default" : "outline"}>
                        #{index + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export const Dashboard: Story = {
  render: () => <DashboardLayout />,
};

// Profile Page Layout
const ProfilePageLayout = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">Contributor.info</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <a href="#" className="text-gray-600 hover:text-gray-900">
                  Repositories
                </a>
                <a href="#" className="text-gray-900 font-medium">
                  Profile
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline">Edit Profile</Button>
              <Button>Share</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">John Doe</h2>
              <p className="text-gray-600 mt-1">@johndoe</p>
              <p className="text-gray-700 mt-2">
                Full-stack developer passionate about open source and building great products.
              </p>
              <div className="flex items-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>1.2k</strong> followers
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>342</strong> stars earned
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <GitCommit className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>892</strong> contributions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Activity Graph */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contribution Activity</CardTitle>
                    <CardDescription>
                      Your contribution graph for the last year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 bg-gradient-to-r from-green-100 to-green-300 rounded-lg flex items-center justify-center">
                      <p className="text-gray-600">Contribution Graph</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start space-x-4">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                          <div className="flex-1">
                            <p className="text-sm">
                              Opened PR{" "}
                              <a href="#" className="font-medium text-blue-600">
                                #123: Add new feature
                              </a>
                            </p>
                            <p className="text-xs text-gray-500">2 hours ago</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Pull Requests</span>
                        <span>89</span>
                      </div>
                      <Progress value={89} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Issues</span>
                        <span>45</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Reviews</span>
                        <span>123</span>
                      </div>
                      <Progress value={100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                {/* Languages */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Languages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {["TypeScript", "JavaScript", "Python", "Go"].map(
                        (lang, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm">{lang}</span>
                            <Badge variant="outline">
                              {Math.floor(Math.random() * 50 + 10)}%
                            </Badge>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="repositories" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Repository {i}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          A sample repository description
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Public</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-400 rounded-full mr-1" />
                        JavaScript
                      </span>
                      <span className="flex items-center">
                        <Star className="h-3 w-3 mr-1" />
                        {Math.floor(Math.random() * 100)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export const ProfilePage: Story = {
  render: () => <ProfilePageLayout />,
};

// Repository View Layout
const RepositoryViewLayout = () => {
  const [activeTab, setActiveTab] = useState("code");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <a href="#" className="text-blue-600 hover:underline">
                organization
              </a>
              <span className="text-gray-500">/</span>
              <h1 className="text-xl font-semibold">repository-name</h1>
              <Badge variant="outline">Public</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-1" />
                Star
              </Button>
              <Button variant="outline" size="sm">
                Fork
              </Button>
              <Button size="sm">
                <GitPullRequest className="h-4 w-4 mr-1" />
                Clone
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Repository Navigation */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-12 bg-transparent border-0">
              <TabsTrigger value="code" className="data-[state=active]:border-b-2">
                Code
              </TabsTrigger>
              <TabsTrigger value="issues" className="data-[state=active]:border-b-2">
                Issues <Badge className="ml-2" variant="secondary">23</Badge>
              </TabsTrigger>
              <TabsTrigger value="pulls" className="data-[state=active]:border-b-2">
                Pull Requests <Badge className="ml-2" variant="secondary">8</Badge>
              </TabsTrigger>
              <TabsTrigger value="contributors" className="data-[state=active]:border-b-2">
                Contributors
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:border-b-2">
                Insights
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "code" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Files</CardTitle>
                    <Button size="sm">Add file</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    {["src/", "docs/", "tests/", "README.md", "package.json"].map(
                      (file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-0"
                        >
                          <div className="flex items-center space-x-3">
                            {file.endsWith("/") ? (
                              <FolderOpen className="h-4 w-4 text-blue-500" />
                            ) : (
                              <div className="h-4 w-4 border rounded" />
                            )}
                            <span className="text-sm font-medium">{file}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Updated 2 days ago
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "contributors" && (
              <Card>
                <CardHeader>
                  <CardTitle>Contributors</CardTitle>
                  <CardDescription>
                    People who have contributed to this repository
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>U{i}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">User {i}</p>
                          <p className="text-xs text-gray-500">
                            {Math.floor(Math.random() * 100)} commits
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  A comprehensive solution for tracking and visualizing open source contributions
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>typescript</Badge>
                  <Badge>react</Badge>
                  <Badge>open-source</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4" />
                    <span>234 stars</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <GitCommit className="h-4 w-4" />
                    <span>1,234 commits</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>45 contributors</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Languages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span>TypeScript</span>
                    </div>
                    <span className="text-gray-500">65%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                      <span>JavaScript</span>
                    </div>
                    <span className="text-gray-500">25%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span>CSS</span>
                    </div>
                    <span className="text-gray-500">10%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RepositoryView: Story = {
  render: () => <RepositoryViewLayout />,
};

// Settings Page Layout
const SettingsPageLayout = () => {
  const [activeSection, setActiveSection] = useState("general");

  const sections = [
    { id: "general", label: "General", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Security", icon: Settings },
    { id: "integrations", label: "Integrations", icon: GitPullRequest },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          activeSection === section.id
                            ? "bg-blue-50 text-blue-700"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  {sections.find((s) => s.id === activeSection)?.label}
                </CardTitle>
                <CardDescription>
                  Manage your {activeSection} settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeSection === "general" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Display Name</label>
                      <Input defaultValue="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input type="email" defaultValue="john@example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bio</label>
                      <textarea
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={4}
                        defaultValue="Software developer passionate about open source"
                      />
                    </div>
                    <Button>Save Changes</Button>
                  </div>
                )}
                {/* Other sections would go here */}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsPage: Story = {
  render: () => <SettingsPageLayout />,
};