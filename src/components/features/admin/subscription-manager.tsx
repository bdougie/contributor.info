import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
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

interface SubscriptionIssue {
  user_id: string;
  email: string;
  workspace_id: string;
  workspace_name: string;
  workspace_tier: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  issue_type: 'missing' | 'mismatch' | 'inactive';
}

export function SubscriptionManager() {
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [issues, setIssues] = useState<SubscriptionIssue[]>([]);

  useEffect(() => {
    if (isAdmin) {
      loadSubscriptionIssues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadSubscriptionIssues = async () => {
    setLoading(true);
    try {
      // Process the data to find issues
      const issuesList: SubscriptionIssue[] = [];

      // Check raw SQL for mismatches
      const { data: rawIssues, error: rawError } = await supabase.rpc('get_subscription_issues');

      if (!rawError && rawIssues) {
        rawIssues.forEach((issue: unknown) => {
          const typedIssue = issue as {
            user_id: string;
            email: string;
            workspace_id: string;
            workspace_name: string;
            workspace_tier: string;
            subscription_tier: string | null;
            subscription_status: string | null;
          };
          let issueType: 'missing' | 'mismatch' | 'inactive' = 'missing';

          if (!typedIssue.subscription_tier) {
            issueType = 'missing';
          } else if (typedIssue.subscription_tier !== typedIssue.workspace_tier) {
            issueType = 'mismatch';
          } else if (typedIssue.subscription_status !== 'active') {
            issueType = 'inactive';
          }

          issuesList.push({
            user_id: typedIssue.user_id,
            email: typedIssue.email || 'Unknown',
            workspace_id: typedIssue.workspace_id,
            workspace_name: typedIssue.workspace_name,
            workspace_tier: typedIssue.workspace_tier,
            subscription_tier: typedIssue.subscription_tier,
            subscription_status: typedIssue.subscription_status,
            issue_type: issueType,
          });
        });
      }

      setIssues(issuesList);
    } catch (error) {
      console.error('Error loading issues:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription issues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fixSubscription = async (issue: SubscriptionIssue, newTier?: string) => {
    setFixing(issue.user_id);

    try {
      const tierToUse = newTier || issue.workspace_tier;

      if (issue.issue_type === 'missing') {
        // Create new subscription
        const { error } = await supabase.from('subscriptions').insert({
          user_id: issue.user_id,
          tier: tierToUse,
          status: 'active',
          max_workspaces: tierToUse === 'team' ? 3 : 1,
          max_repos_per_workspace: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      } else {
        // Update existing subscription
        const { error } = await supabase
          .from('subscriptions')
          .update({
            tier: tierToUse,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', issue.user_id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Fixed subscription for ${issue.email}`,
      });

      // Reload issues
      await loadSubscriptionIssues();
    } catch (error) {
      console.error('Error fixing subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to fix subscription',
        variant: 'destructive',
      });
    } finally {
      setFixing(null);
    }
  };

  const fixAllIssues = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to fix all ${issues.length} subscription issues?`
    );
    if (!confirmed) return;

    let fixed = 0;
    let failed = 0;

    for (const issue of issues) {
      try {
        await fixSubscription(issue);
        fixed++;
      } catch {
        failed++;
      }
    }

    toast({
      title: 'Bulk Fix Complete',
      description: `Fixed ${fixed} subscriptions, ${failed} failed`,
    });
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Admin access required</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription Manager</CardTitle>
            <CardDescription>
              Fix subscription issues for customers with paid workspaces
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadSubscriptionIssues} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {issues.length > 0 && (
              <Button onClick={fixAllIssues} variant="destructive" size="sm">
                Fix All ({issues.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>No subscription issues found!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Workspace Tier</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{issue.email}</p>
                      <p className="text-xs text-muted-foreground">{issue.user_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{issue.workspace_name}</p>
                      <p className="text-xs text-muted-foreground">{issue.workspace_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>{issue.workspace_tier}</Badge>
                  </TableCell>
                  <TableCell>
                    {issue.subscription_tier ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{issue.subscription_tier}</Badge>
                        <Badge
                          variant={issue.subscription_status === 'active' ? 'default' : 'secondary'}
                        >
                          {issue.subscription_status}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">
                        {issue.issue_type === 'missing' && 'Missing subscription'}
                        {issue.issue_type === 'mismatch' && 'Tier mismatch'}
                        {issue.issue_type === 'inactive' && 'Inactive subscription'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(tier) => fixSubscription(issue, tier)}
                        disabled={fixing === issue.user_id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Fix tier..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => fixSubscription(issue)}
                        disabled={fixing === issue.user_id}
                        size="sm"
                        variant="outline"
                      >
                        {fixing === issue.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Auto Fix'
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
