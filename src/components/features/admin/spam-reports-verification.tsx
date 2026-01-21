import { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Users,
  Ban,
  Star,
  FileText,
} from '@/components/ui/icon';
import { getSupabase } from '@/lib/supabase-lazy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router';
import { logAdminAction, useAdminGitHubId } from '@/hooks/use-admin-auth';
import type { SpamReport, SpamCategory } from '@/lib/spam/types/spam-report.types';

interface SpamReportWithReporter extends SpamReport {
  spam_reporters?: {
    id: string;
    accuracy_score: number;
    is_trusted: boolean;
    is_banned: boolean;
    total_reports: number;
    verified_reports: number;
    rejected_reports: number;
    github_login: string | null;
  } | null;
}

interface SpamReporter {
  id: string;
  user_id: string | null;
  github_login: string | null;
  total_reports: number;
  verified_reports: number;
  rejected_reports: number;
  accuracy_score: number;
  is_trusted: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  created_at: string;
}

const SPAM_CATEGORY_LABELS: Record<SpamCategory, string> = {
  hacktoberfest: 'Hacktoberfest',
  bot_automated: 'Bot/Automated',
  fake_contribution: 'Fake Contribution',
  self_promotion: 'Self-Promotion',
  low_quality: 'Low Quality',
  other: 'Other',
};

export function SpamReportsVerification() {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState<SpamReportWithReporter[]>([]);
  const [reporters, setReporters] = useState<SpamReporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>(
    'pending'
  );
  const [filterCategory, setFilterCategory] = useState<SpamCategory | 'all'>('all');
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'verified' | 'rejected'>('verified');
  const [reporterActionDialog, setReporterActionDialog] = useState(false);
  const [selectedReporter, setSelectedReporter] = useState<SpamReporter | null>(null);
  const [reporterAction, setReporterAction] = useState<'ban' | 'unban' | 'trust' | 'untrust'>(
    'ban'
  );
  const [banReason, setBanReason] = useState('');
  const adminGitHubId = useAdminGitHubId();

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchReporters();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();
      const { data, error: fetchError } = await supabase
        .from('spam_reports')
        .select(
          `
          *,
          spam_reporters (
            id,
            accuracy_score,
            is_trusted,
            is_banned,
            total_reports,
            verified_reports,
            rejected_reports,
            github_login
          )
        `
        )
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setReports(data || []);
    } catch (err) {
      console.error('Error fetching spam reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch spam reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchReporters = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();
      const { data, error: fetchError } = await supabase
        .from('spam_reporters')
        .select('*')
        .order('total_reports', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setReporters(data || []);
    } catch (err) {
      console.error('Error fetching reporters:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reporters');
    } finally {
      setLoading(false);
    }
  };

  const verifyReport = async (report: SpamReportWithReporter, status: 'verified' | 'rejected') => {
    if (!adminGitHubId) return;

    try {
      const supabase = await getSupabase();
      const { data, error: rpcError } = await supabase.rpc('verify_spam_report', {
        p_report_id: report.id,
        p_admin_id: null, // Will use auth.uid() in function
        p_status: status,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to verify report');
      }

      // Log admin action
      await logAdminAction(adminGitHubId, `spam_report_${status}`, 'spam_report', report.id, {
        pr_url: report.pr_url,
        contributor: report.contributor_github_login,
        category: report.spam_category,
        old_status: report.status,
        new_status: status,
      });

      // Update local state
      setReports(
        reports.map((r) =>
          r.id === report.id ? { ...r, status, verified_at: new Date().toISOString() } : r
        )
      );
    } catch (err) {
      console.error('Error verifying report:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify report');
    }
  };

  const handleBulkVerify = async () => {
    if (!adminGitHubId || selectedReports.size === 0) return;

    try {
      const supabase = await getSupabase();
      const reportIds = Array.from(selectedReports);

      const { data, error: rpcError } = await supabase.rpc('bulk_verify_spam_reports', {
        p_report_ids: reportIds,
        p_admin_id: null,
        p_status: bulkAction,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Log admin action
      await logAdminAction(adminGitHubId, `bulk_spam_${bulkAction}`, 'spam_reports', 'bulk', {
        count: reportIds.length,
        processed: data?.processed,
      });

      // Refresh reports
      await fetchReports();
      setSelectedReports(new Set());
      setBulkActionDialog(false);
    } catch (err) {
      console.error('Error bulk verifying:', err);
      setError(err instanceof Error ? err.message : 'Failed to bulk verify');
    }
  };

  const handleAutoVerify = async () => {
    if (!adminGitHubId) return;

    try {
      const supabase = await getSupabase();
      const { data, error: rpcError } = await supabase.rpc('auto_verify_spam_reports', {
        p_threshold: 3,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Log admin action
      await logAdminAction(adminGitHubId, 'auto_verify_spam_reports', 'spam_reports', 'auto', {
        verified_count: data?.verified_count,
        threshold: 3,
      });

      // Refresh reports
      await fetchReports();

      if (data?.verified_count > 0) {
        setError(null);
      }
    } catch (err) {
      console.error('Error auto-verifying:', err);
      setError(err instanceof Error ? err.message : 'Failed to auto-verify');
    }
  };

  const handleReporterAction = async () => {
    if (!adminGitHubId || !selectedReporter) return;

    try {
      const supabase = await getSupabase();
      const { error: rpcError } = await supabase.rpc('manage_spam_reporter', {
        p_reporter_id: selectedReporter.id,
        p_admin_id: null,
        p_action: reporterAction,
        p_reason: reporterAction === 'ban' ? banReason : null,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Log admin action
      await logAdminAction(
        adminGitHubId,
        `reporter_${reporterAction}`,
        'spam_reporter',
        selectedReporter.id,
        {
          github_login: selectedReporter.github_login,
          reason: banReason || null,
        }
      );

      // Refresh reporters
      await fetchReporters();
      setReporterActionDialog(false);
      setSelectedReporter(null);
      setBanReason('');
    } catch (err) {
      console.error('Error managing reporter:', err);
      setError(err instanceof Error ? err.message : 'Failed to manage reporter');
    }
  };

  const toggleReportSelection = (reportId: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReports(newSelected);
  };

  const selectAllPending = () => {
    const pendingIds = filteredReports.filter((r) => r.status === 'pending').map((r) => r.id);
    setSelectedReports(new Set(pendingIds));
  };

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.contributor_github_login?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.pr_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.pr_repo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || report.spam_category === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Filter reporters
  const filteredReporters = reporters.filter((reporter) => {
    return reporter.github_login?.toLowerCase().includes(searchTerm.toLowerCase()) || !searchTerm;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    verified: reports.filter((r) => r.status === 'verified').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
    autoVerifyEligible: reports.filter((r) => r.status === 'pending' && r.report_count >= 3).length,
  };

  const reporterStats = {
    total: reporters.length,
    trusted: reporters.filter((r) => r.is_trusted).length,
    banned: reporters.filter((r) => r.is_banned).length,
    lowAccuracy: reporters.filter((r) => r.accuracy_score < 50 && r.total_reports >= 5).length,
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'verified':
        return 'destructive';
      case 'rejected':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getAccuracyBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 50) return 'secondary';
    return 'destructive';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading spam reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Community Spam Reports</h1>
          <p className="text-muted-foreground">
            Verify community-submitted spam reports and manage reporters
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports ({stats.pending} pending)
          </TabsTrigger>
          <TabsTrigger value="reporters">
            <Users className="h-4 w-4 mr-2" />
            Reporters ({reporterStats.total})
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pending</span>
                </div>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Verified Spam</span>
                </div>
                <p className="text-2xl font-bold">{stats.verified}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Rejected</span>
                </div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Auto-Verify Ready</span>
                </div>
                <p className="text-2xl font-bold">{stats.autoVerifyEligible}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Actions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters & Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by contributor, PR URL, or repository..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) =>
                      setFilterStatus(v as 'all' | 'pending' | 'verified' | 'rejected')
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterCategory}
                    onValueChange={(v) => setFilterCategory(v as SpamCategory | 'all')}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(SPAM_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchReports} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    onClick={selectAllPending}
                    variant="outline"
                    size="sm"
                    disabled={stats.pending === 0}
                  >
                    Select All Pending ({stats.pending})
                  </Button>
                  <Button
                    onClick={() => setSelectedReports(new Set())}
                    variant="outline"
                    size="sm"
                    disabled={selectedReports.size === 0}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={() => {
                      setBulkAction('verified');
                      setBulkActionDialog(true);
                    }}
                    variant="destructive"
                    size="sm"
                    disabled={selectedReports.size === 0}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Verify Selected ({selectedReports.size})
                  </Button>
                  <Button
                    onClick={() => {
                      setBulkAction('rejected');
                      setBulkActionDialog(true);
                    }}
                    variant="default"
                    size="sm"
                    disabled={selectedReports.size === 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Reject Selected ({selectedReports.size})
                  </Button>
                  <Button
                    onClick={handleAutoVerify}
                    variant="secondary"
                    size="sm"
                    disabled={stats.autoVerifyEligible === 0}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Auto-Verify (3+ reports)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Spam Reports ({filteredReports.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            filteredReports.filter((r) => r.status === 'pending').length > 0 &&
                            filteredReports
                              .filter((r) => r.status === 'pending')
                              .every((r) => selectedReports.has(r.id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllPending();
                            } else {
                              setSelectedReports(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>PR / Contributor</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedReports.has(report.id)}
                            onCheckedChange={() => toggleReportSelection(report.id)}
                            disabled={report.status !== 'pending'}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate max-w-[200px]">
                                {report.pr_repo}#{report.pr_number}
                              </span>
                              <Link to={report.pr_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </Link>
                            </div>
                            {report.contributor_github_login && (
                              <p className="text-sm text-muted-foreground">
                                by @{report.contributor_github_login}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SPAM_CATEGORY_LABELS[report.spam_category]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.spam_reporters?.github_login ? (
                              <div className="flex items-center gap-1">
                                <span>@{report.spam_reporters.github_login}</span>
                                {report.spam_reporters.is_trusted && (
                                  <Star className="h-3 w-3 text-yellow-500" />
                                )}
                                {report.spam_reporters.is_banned && (
                                  <Ban className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Anonymous</span>
                            )}
                            {report.spam_reporters && (
                              <Badge
                                variant={getAccuracyBadgeVariant(
                                  report.spam_reporters.accuracy_score
                                )}
                                className="text-xs mt-1"
                              >
                                {report.spam_reporters.accuracy_score}% accuracy
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={report.report_count >= 3 ? 'destructive' : 'secondary'}>
                            {report.report_count}x
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(report.status)}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(report.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {report.status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => verifyReport(report, 'verified')}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Spam
                                </Button>
                                <Button
                                  onClick={() => verifyReport(report, 'rejected')}
                                  variant="default"
                                  size="sm"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Not Spam
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporters Tab */}
        <TabsContent value="reporters">
          {/* Reporter Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Reporters</span>
                </div>
                <p className="text-2xl font-bold">{reporterStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Trusted</span>
                </div>
                <p className="text-2xl font-bold">{reporterStats.trusted}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Banned</span>
                </div>
                <p className="text-2xl font-bold">{reporterStats.banned}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Low Accuracy</span>
                </div>
                <p className="text-2xl font-bold">{reporterStats.lowAccuracy}</p>
              </CardContent>
            </Card>
          </div>

          {/* Reporters Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Reporters ({filteredReporters.length})</CardTitle>
                <Button onClick={fetchReporters} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Rejected</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReporters.map((reporter) => (
                      <TableRow key={reporter.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {reporter.github_login ? (
                              <>
                                <span className="font-medium">@{reporter.github_login}</span>
                                <Link
                                  to={`https://github.com/${reporter.github_login}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </Link>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Anonymous</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{reporter.total_reports}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600">{reporter.verified_reports}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600">{reporter.rejected_reports}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getAccuracyBadgeVariant(reporter.accuracy_score)}>
                            {reporter.accuracy_score}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {reporter.is_trusted && (
                              <Badge variant="default">
                                <Star className="h-3 w-3 mr-1" />
                                Trusted
                              </Badge>
                            )}
                            {reporter.is_banned && (
                              <Badge variant="destructive">
                                <Ban className="h-3 w-3 mr-1" />
                                Banned
                              </Badge>
                            )}
                            {!reporter.is_trusted && !reporter.is_banned && (
                              <Badge variant="secondary">Normal</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!reporter.is_banned && (
                              <Button
                                onClick={() => {
                                  setSelectedReporter(reporter);
                                  setReporterAction('ban');
                                  setReporterActionDialog(true);
                                }}
                                variant="destructive"
                                size="sm"
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Ban
                              </Button>
                            )}
                            {reporter.is_banned && (
                              <Button
                                onClick={() => {
                                  setSelectedReporter(reporter);
                                  setReporterAction('unban');
                                  setReporterActionDialog(true);
                                }}
                                variant="default"
                                size="sm"
                              >
                                Unban
                              </Button>
                            )}
                            {!reporter.is_trusted && !reporter.is_banned && (
                              <Button
                                onClick={() => {
                                  setSelectedReporter(reporter);
                                  setReporterAction('trust');
                                  setReporterActionDialog(true);
                                }}
                                variant="outline"
                                size="sm"
                              >
                                <Star className="h-3 w-3 mr-1" />
                                Trust
                              </Button>
                            )}
                            {reporter.is_trusted && (
                              <Button
                                onClick={() => {
                                  setSelectedReporter(reporter);
                                  setReporterAction('untrust');
                                  setReporterActionDialog(true);
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Untrust
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialog} onOpenChange={setBulkActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === 'verified' ? 'Verify Selected Reports' : 'Reject Selected Reports'}
            </DialogTitle>
            <DialogDescription>
              You are about to {bulkAction === 'verified' ? 'verify' : 'reject'}{' '}
              {selectedReports.size} reports.
              {bulkAction === 'verified' &&
                ' This will add the contributors to the known spammers list.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkAction === 'verified' ? 'destructive' : 'default'}
              onClick={handleBulkVerify}
            >
              {bulkAction === 'verified' ? 'Verify as Spam' : 'Reject Reports'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reporter Action Dialog */}
      <Dialog open={reporterActionDialog} onOpenChange={setReporterActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reporterAction === 'ban' && 'Ban Reporter'}
              {reporterAction === 'unban' && 'Unban Reporter'}
              {reporterAction === 'trust' && 'Trust Reporter'}
              {reporterAction === 'untrust' && 'Remove Trust'}
            </DialogTitle>
            <DialogDescription>
              {reporterAction === 'ban' &&
                `Ban ${selectedReporter?.github_login || 'this reporter'} from submitting spam reports.`}
              {reporterAction === 'unban' &&
                `Allow ${selectedReporter?.github_login || 'this reporter'} to submit reports again.`}
              {reporterAction === 'trust' &&
                `Grant trusted status to ${selectedReporter?.github_login || 'this reporter'} (higher rate limits).`}
              {reporterAction === 'untrust' &&
                `Remove trusted status from ${selectedReporter?.github_login || 'this reporter'}.`}
            </DialogDescription>
          </DialogHeader>

          {reporterAction === 'ban' && (
            <div className="py-4">
              <label className="text-sm font-medium">Ban Reason</label>
              <Textarea
                placeholder="Enter reason for banning this reporter..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReporterActionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={reporterAction === 'ban' ? 'destructive' : 'default'}
              onClick={handleReporterAction}
            >
              {reporterAction === 'ban' && 'Ban Reporter'}
              {reporterAction === 'unban' && 'Unban Reporter'}
              {reporterAction === 'trust' && 'Grant Trust'}
              {reporterAction === 'untrust' && 'Remove Trust'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
