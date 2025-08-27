import { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  Ban,
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

interface SpamDetection {
  id: string;
  pr_id: string;
  contributor_id: string;
  spam_score: number;
  detected_at: string;
  status: 'pending' | 'confirmed' | 'false_positive';
  admin_reviewed_by?: number;
  admin_reviewed_at?: string;
  detection_reasons: string[];
  pull_requests?: {
    title: string;
    html_url: string;
    repository: {
      full_name: string;
    };
  };
  contributors?: {
    username: string;
    avatar_url?: string;
  };
}

export function SpamManagement() {
  const [detections, setDetections] = useState<SpamDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'pending' | 'confirmed' | 'false_positive'
  >('all');
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const adminGitHubId = useAdminGitHubId();

  useEffect(() => {
    fetchSpamDetections();
  }, []);

  const fetchSpamDetections = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('spam_detections')
        .select(
          `
          *,
          pull_requests (
            title,
            html_url,
            repository:repositories (
              full_name
            )
          ),
          contributors (
            username,
            avatar_url
          )
        `
        )
        .order('detected_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDetections(data || []);
    } catch (err) {
      console.error('Error fetching spam detections:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch spam detections');
    } finally {
      setLoading(false);
    }
  };

  const updateSpamStatus = async (
    detection: SpamDetection,
    newStatus: 'confirmed' | 'false_positive'
  ) => {
    if (!adminGitHubId) return;

    try {
      const { error: updateError } = await supabase
        .from('spam_detections')
        .update({
          status: newStatus,
          admin_reviewed_by: adminGitHubId,
          admin_reviewed_at: new Date().toISOString(),
        })
        .eq('id', detection.id);

      if (updateError) {
        throw updateError;
      }

      // Log admin action
      await logAdminAction(adminGitHubId, 'spam_status_updated', 'spam_detection', detection.id, {
        pr_id: detection.pr_id,
        contributor_username: detection.contributors?.username,
        old_status: detection.status,
        new_status: newStatus,
        spam_score: detection.spam_score,
      });

      // Update local state
      setDetections(
        detections.map((d) =>
          d.id === detection.id
            ? {
                ...d,
                status: newStatus,
                admin_reviewed_by: adminGitHubId,
                admin_reviewed_at: new Date().toISOString(),
              }
            : d
        )
      );
    } catch (err) {
      console.error('Error updating spam status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update spam status');
    }
  };

  // Filter detections based on search and filter criteria
  const filteredDetections = detections.filter((detection) => {
    const matchesSearch =
      detection.contributors?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detection.pull_requests?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detection.pull_requests?.repository?.full_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || detection.status === filterStatus;

    const matchesScore =
      filterScore === 'all' ||
      (filterScore === 'high' && detection.spam_score >= 0.8) ||
      (filterScore === 'medium' && detection.spam_score >= 0.5 && detection.spam_score < 0.8) ||
      (filterScore === 'low' && detection.spam_score < 0.5);

    return matchesSearch && matchesStatus && matchesScore;
  });

  const stats = {
    total: detections.length,
    pending: detections.filter((d) => d.status === 'pending').length,
    confirmed: detections.filter((d) => d.status === 'confirmed').length,
    falsePositives: detections.filter((d) => d.status === 'false_positive').length,
    highRisk: detections.filter((d) => d.spam_score >= 0.8).length,
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'destructive';
    if (score >= 0.5) return 'secondary';
    return 'outline';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'destructive';
      case 'false_positive':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading spam detections...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-red-100 text-red-600">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Spam Management</h1>
          <p className="text-muted-foreground">Review and manage spam detection results</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              <span className="text-sm text-muted-foreground">Confirmed</span>
            </div>
            <p className="text-2xl font-bold">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">False Positives</span>
            </div>
            <p className="text-2xl font-bold">{stats.falsePositives}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">High Risk</span>
            </div>
            <p className="text-2xl font-bold">{stats.highRisk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by contributor, PR title, or repository..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="false_positive">False Positive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterScore} onValueChange={(value: any) => setFilterScore(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="high">High (≥80%)</SelectItem>
                <SelectItem value="medium">Medium (50-79%)</SelectItem>
                <SelectItem value="low">Low (&lt;50%)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchSpamDetections} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Spam Detections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Spam Detections ({filteredDetections.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contributor</TableHead>
                  <TableHead>Pull Request</TableHead>
                  <TableHead>Spam Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetections.map((detection) => (
                  <TableRow key={detection.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={detection.contributors?.avatar_url}
                            alt={detection.contributors?.username}
                          />
                          <AvatarFallback>
                            {detection.contributors?.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{detection.contributors?.username}</span>
                            <Link
                              to={`https://github.com/${detection.contributors?.username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[200px]">
                            {detection.pull_requests?.title}
                          </span>
                          {detection.pull_requests?.html_url && (
                            <Link
                              to={detection.pull_requests.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Link>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {detection.pull_requests?.repository?.full_name}
                        </p>
                        <div className="mt-1">
                          {detection.detection_reasons.map((reason, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs mr-1">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getScoreBadgeVariant(detection.spam_score)}>
                        {Math.round(detection.spam_score * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(detection.status)}>
                        {detection.status === 'false_positive'
                          ? 'False Positive'
                          : detection.status.charAt(0).toUpperCase() + detection.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(detection.detected_at).toLocaleDateString()}
                        <div className="text-xs text-muted-foreground">
                          {new Date(detection.detected_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {detection.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => updateSpamStatus(detection, 'confirmed')}
                              variant="destructive"
                              size="sm"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Confirm Spam
                            </Button>
                            <Button
                              onClick={() => updateSpamStatus(detection, 'false_positive')}
                              variant="default"
                              size="sm"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Not Spam
                            </Button>
                          </>
                        )}
                        {detection.status !== 'pending' && (
                          <Button
                            onClick={() => {
                              if (detection.pull_requests?.html_url) {
                                window.open(detection.pull_requests.html_url, '_blank');
                              }
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
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
    </div>
  );
}
