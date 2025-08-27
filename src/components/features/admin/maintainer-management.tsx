import { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  User,
  Crown,
  Lock,
  Unlock,
  RefreshCw,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Bot,
} from '@/components/ui/icon';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { logAdminAction, useAdminGitHubId } from '@/hooks/use-admin-auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RoleBadge } from '@/components/ui/role-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ContributorRoleData {
  id: string;
  user_id: string;
  repository_owner: string;
  repository_name: string;
  role: 'owner' | 'maintainer' | 'contributor' | 'bot';
  confidence_score: number;
  detected_at: string;
  last_verified: string;
  detection_methods: string[];
  permission_events_count: number;
  admin_override: boolean;
  admin_override_by?: number;
  admin_override_at?: string;
  override_reason?: string;
  locked: boolean;
}

interface RoleChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, lock: boolean) => void;
  contributor: ContributorRoleData;
  newRole: string;
}

function RoleChangeDialog({
  isOpen,
  onClose,
  onConfirm,
  contributor,
  newRole,
}: RoleChangeDialogProps) {
  const [reason, setReason] = useState('');
  const [lock, setLock] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Contributor Role</DialogTitle>
          <DialogDescription>
            You are about to change {contributor.user_id}'s role from{' '}
            <Badge variant="outline" className="mx-1">
              {contributor.role}
            </Badge>
            to
            <Badge variant="outline" className="mx-1">
              {newRole}
            </Badge>
            in {contributor.repository_owner}/{contributor.repository_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="reason">Reason for override</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this manual override is necessary..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="lock"
              checked={lock}
              onChange={(e) => setLock(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="lock" className="flex items-center gap-2 cursor-pointer">
              <Lock className="h-4 w-4" />
              Lock this role (prevent algorithm from changing it)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(reason, lock)} disabled={!reason.trim()}>
            Confirm Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MaintainerManagement() {
  const [contributors, setContributors] = useState<ContributorRoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<
    'all' | 'owner' | 'maintainer' | 'contributor' | 'bot'
  >('all');
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all'
  );
  const [filterOverride, setFilterOverride] = useState<'all' | 'manual' | 'algorithm'>('all');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [repos, setRepos] = useState<string[]>([]);
  const adminGitHubId = useAdminGitHubId();

  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    isOpen: boolean;
    contributor?: ContributorRoleData;
    newRole?: string;
  }>({ isOpen: false });

  useEffect(() => {
    fetchContributorRoles();
  }, []);

  const fetchContributorRoles = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('contributor_roles')
        .select('*')
        .order('confidence_score', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setContributors(data || []);

      // Extract unique repos
      const uniqueRepos = [
        ...new Set((data || []).map((c) => `${c.repository_owner}/${c.repository_name}`)),
      ];
      setRepos(uniqueRepos);
    } catch (err) {
      console.error('Error fetching contributor roles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch contributor roles');
    } finally {
      setLoading(false);
    }
  };

  const updateContributorRole = async (
    contributor: ContributorRoleData,
    newRole: 'owner' | 'maintainer' | 'contributor' | 'bot',
    reason: string,
    lock: boolean
  ) => {
    if (!adminGitHubId) return;

    try {
      // Call the database function
      const { error: updateError } = await supabase.rpc('override_contributor_role', {
        p_user_id: contributor.user_id,
        p_repository_owner: contributor.repository_owner,
        p_repository_name: contributor.repository_name,
        p_new_role: newRole,
        p_admin_github_id: adminGitHubId,
        p_reason: reason,
        p_lock: lock,
      });

      if (updateError) {
        throw updateError;
      }

      // Log admin action
      await logAdminAction(adminGitHubId, 'role_override', 'contributor_role', contributor.id, {
        user_id: contributor.user_id,
        repository: `${contributor.repository_owner}/${contributor.repository_name}`,
        old_role: contributor.role,
        new_role: newRole,
        confidence_score: contributor.confidence_score,
        reason,
        locked: lock,
      });

      // Refresh data
      await fetchContributorRoles();
    } catch (err) {
      console.error('Error updating contributor role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const toggleLock = async (contributor: ContributorRoleData) => {
    if (!adminGitHubId) return;

    try {
      const { error: updateError } = await supabase
        .from('contributor_roles')
        .update({
          locked: !contributor.locked,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contributor.id);

      if (updateError) {
        throw updateError;
      }

      // Log admin action
      await logAdminAction(
        adminGitHubId,
        contributor.locked ? 'role_unlocked' : 'role_locked',
        'contributor_role',
        contributor.id,
        {
          user_id: contributor.user_id,
          repository: `${contributor.repository_owner}/${contributor.repository_name}`,
          role: contributor.role,
        }
      );

      // Update local state
      setContributors(
        contributors.map((c) => (c.id === contributor.id ? { ...c, locked: !c.locked } : c))
      );
    } catch (err) {
      console.error('Error toggling lock:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle lock');
    }
  };

  // Filter contributors based on search and filter criteria
  const filteredContributors = contributors.filter((contributor) => {
    const fullRepo = `${contributor.repository_owner}/${contributor.repository_name}`;

    const matchesSearch =
      contributor.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullRepo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' || contributor.role === filterRole;

    const matchesConfidence =
      filterConfidence === 'all' ||
      (filterConfidence === 'high' && contributor.confidence_score >= 0.8) ||
      (filterConfidence === 'medium' &&
        contributor.confidence_score >= 0.5 &&
        contributor.confidence_score < 0.8) ||
      (filterConfidence === 'low' && contributor.confidence_score < 0.5);

    const matchesOverride =
      filterOverride === 'all' ||
      (filterOverride === 'manual' && contributor.admin_override) ||
      (filterOverride === 'algorithm' && !contributor.admin_override);

    const matchesRepo = selectedRepo === 'all' || fullRepo === selectedRepo;

    return matchesSearch && matchesRole && matchesConfidence && matchesOverride && matchesRepo;
  });

  const stats = {
    total: contributors.length,
    owners: contributors.filter((c) => c.role === 'owner').length,
    maintainers: contributors.filter((c) => c.role === 'maintainer').length,
    bots: contributors.filter((c) => c.role === 'bot').length,
    manualOverrides: contributors.filter((c) => c.admin_override).length,
    lockedRoles: contributors.filter((c) => c.locked).length,
    highConfidence: contributors.filter((c) => c.confidence_score >= 0.8).length,
  };

  const getConfidenceBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'default';
    if (score >= 0.5) return 'secondary';
    return 'outline';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-orange-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading maintainer data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Maintainer Management</h1>
          <p className="text-muted-foreground">
            Review and manage contributor roles across repositories
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">Owners</span>
            </div>
            <p className="text-2xl font-bold">{stats.owners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Maintainers</span>
            </div>
            <p className="text-2xl font-bold">{stats.maintainers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-muted-foreground">Bots</span>
            </div>
            <p className="text-2xl font-bold">{stats.bots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Manual</span>
            </div>
            <p className="text-2xl font-bold">{stats.manualOverrides}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-muted-foreground">Locked</span>
            </div>
            <p className="text-2xl font-bold">{stats.lockedRoles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">High Conf</span>
            </div>
            <p className="text-2xl font-bold">{stats.highConfidence}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or repository..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedRepo} onValueChange={setSelectedRepo}>
              <SelectTrigger>
                <SelectValue placeholder="All repositories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All repositories</SelectItem>
                {repos.map((repo) => (
                  <SelectItem key={repo} value={repo}>
                    {repo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={(value: any) => setFilterRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">Owners</SelectItem>
                <SelectItem value="maintainer">Maintainers</SelectItem>
                <SelectItem value="contributor">Contributors</SelectItem>
                <SelectItem value="bot">Bots</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterConfidence}
              onValueChange={(value: any) => setFilterConfidence(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All confidence</SelectItem>
                <SelectItem value="high">High (≥80%)</SelectItem>
                <SelectItem value="medium">Medium (50-79%)</SelectItem>
                <SelectItem value="low">Low (&lt;50%)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOverride} onValueChange={(value: any) => setFilterOverride(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="manual">Manual overrides</SelectItem>
                <SelectItem value="algorithm">Algorithm detected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Contributor Roles
            <Badge variant="secondary" className="ml-2">
              {filteredContributors.length} results
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Detection</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContributors.map((contributor) => (
                <TableRow key={contributor.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={`https://github.com/${contributor.user_id}.png`}
                          alt={contributor.user_id}
                        />
                        <AvatarFallback>
                          {contributor.user_id.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Link
                        to={`https://github.com/${contributor.user_id}`}
                        target="_blank"
                        className="font-medium hover:underline"
                      >
                        {contributor.user_id}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/${contributor.repository_owner}/${contributor.repository_name}`}
                      className="text-sm hover:underline"
                    >
                      {contributor.repository_owner}/{contributor.repository_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={contributor.role} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={getConfidenceBadgeVariant(contributor.confidence_score)}
                        className={cn('text-xs', getConfidenceColor(contributor.confidence_score))}
                      >
                        {Math.round(contributor.confidence_score * 100)}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {contributor.admin_override ? (
                        <Badge variant="outline" className="text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Manual
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Algorithm
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {contributor.permission_events_count} events
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {contributor.locked && (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      )}
                      {contributor.admin_override && contributor.override_reason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>{contributor.override_reason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={contributor.role}
                        onValueChange={(newRole: any) => {
                          setRoleChangeDialog({
                            isOpen: true,
                            contributor,
                            newRole,
                          });
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="maintainer">Maintainer</SelectItem>
                          <SelectItem value="contributor">Contributor</SelectItem>
                          <SelectItem value="bot">Bot</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleLock(contributor)}
                        title={contributor.locked ? 'Unlock role' : 'Lock role'}
                      >
                        {contributor.locked ? (
                          <Unlock className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      {roleChangeDialog.contributor && roleChangeDialog.newRole && (
        <RoleChangeDialog
          isOpen={roleChangeDialog.isOpen}
          onClose={() => setRoleChangeDialog({ isOpen: false })}
          onConfirm={(reason, lock) => {
            updateContributorRole(
              roleChangeDialog.contributor!,
              roleChangeDialog.newRole as any,
              reason,
              lock
            );
            setRoleChangeDialog({ isOpen: false });
          }}
          contributor={roleChangeDialog.contributor}
          newRole={roleChangeDialog.newRole}
        />
      )}
    </div>
  );
}
