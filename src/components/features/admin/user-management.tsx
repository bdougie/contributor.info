import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  Search, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Clock,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AppUser {
  id: string;
  auth_user_id: string | null;
  github_username: string;
  github_user_id: number | null;
  email: string | null;
  avatar_url: string | null;
  display_name: string | null;
  is_admin: boolean;
  is_active: boolean;
  first_login_at: string;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
  is_active: boolean;
}

export function UserManagement() {
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    // Filter users based on search and role filter
    let filtered = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.github_username.toLowerCase().includes(term) ||
        user.display_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== "all") {
      if (roleFilter === "admin") {
        filtered = filtered.filter(user => user.is_admin);
      } else if (roleFilter === "user") {
        filtered = filtered.filter(user => !user.is_admin);
      } else if (roleFilter === "inactive") {
        filtered = filtered.filter(user => !user.is_active);
      }
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserRoles = async (userId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_roles')
        .select(`
          id,
          role,
          granted_at,
          granted_by,
          is_active,
          granter:granted_by(github_username)
        `)
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setUserRoles(data || []);
    } catch (err) {
      console.error('Failed to load user roles:', err);
    }
  };

  const handleUserClick = async (user: AppUser) => {
    setSelectedUser(user);
    await loadUserRoles(user.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access user management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>
          <p className="text-muted-foreground">
            Manage application users, roles, and permissions
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by username, name, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="admin">Administrators</SelectItem>
                  <SelectItem value="user">Regular Users</SelectItem>
                  <SelectItem value="inactive">Inactive Users</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={loadUsers}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Users ({filteredUsers.length})</span>
              <Button disabled>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User (Coming Soon)
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading users...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback>
                              {user.github_username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.github_username}</div>
                            <div className="text-sm text-muted-foreground">
                              {user.display_name || user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.is_admin ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatDate(user.last_login_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUserClick(user)}
                            >
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={selectedUser?.avatar_url || ''} />
                                  <AvatarFallback>
                                    {selectedUser?.github_username.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                User Details: {selectedUser?.github_username}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedUser && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium">GitHub Username</label>
                                    <p className="text-sm text-muted-foreground">{selectedUser.github_username}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Display Name</label>
                                    <p className="text-sm text-muted-foreground">{selectedUser.display_name || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Email</label>
                                    <p className="text-sm text-muted-foreground">{selectedUser.email || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">GitHub ID</label>
                                    <p className="text-sm text-muted-foreground">{selectedUser.github_user_id || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">First Login</label>
                                    <p className="text-sm text-muted-foreground">{formatDate(selectedUser.first_login_at)}</p>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Last Login</label>
                                    <p className="text-sm text-muted-foreground">{formatDate(selectedUser.last_login_at)}</p>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-3">Roles</h4>
                                  <div className="space-y-2">
                                    {userRoles.filter(r => r.is_active).map((role) => (
                                      <div key={role.id} className="flex items-center justify-between p-3 border rounded">
                                        <div className="flex items-center gap-3">
                                          <Badge variant={getRoleBadgeVariant(role.role)}>
                                            {role.role}
                                          </Badge>
                                          <span className="text-sm">
                                            Granted {formatDate(role.granted_at)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                    {userRoles.filter(r => r.is_active).length === 0 && (
                                      <p className="text-sm text-muted-foreground">No active roles</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {searchTerm || roleFilter !== "all" ? "No users match your filters" : "No users found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}