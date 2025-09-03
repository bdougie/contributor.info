import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IssueMetricsAndTrendsCard } from '@/components/features/activity/issue-metrics-and-trends-card';
import { WorkspaceIssueMetricsAndTrends } from '@/components/features/workspace/WorkspaceIssueMetricsAndTrends';

export default function TestIssueMetrics() {
  const [owner, setOwner] = useState('facebook');
  const [repo, setRepo] = useState('react');
  const [timeRange, setTimeRange] = useState('30');
  const [showMetrics, setShowMetrics] = useState(false);
  const [viewType, setViewType] = useState<'single' | 'workspace'>('single');

  // Mock workspace data for workspace view
  const mockRepositories = [
    {
      id: 'repo-1',
      owner: 'facebook',
      name: 'react',
      full_name: 'facebook/react',
      stars: 225000,
      forks: 46000,
      open_prs: 234,
      open_issues: 1500,
      contributors: 1200,
      last_activity: '2025-01-15T10:30:00Z',
      language: 'JavaScript',
      html_url: 'https://github.com/facebook/react',
    },
    {
      id: 'repo-2',
      owner: 'microsoft',
      name: 'vscode',
      full_name: 'microsoft/vscode',
      stars: 161000,
      forks: 28500,
      open_prs: 189,
      open_issues: 8900,
      contributors: 1800,
      last_activity: '2025-01-15T11:20:00Z',
      language: 'TypeScript',
      html_url: 'https://github.com/microsoft/vscode',
    },
    {
      id: 'repo-3',
      owner: 'google',
      name: 'material-design-lite',
      full_name: 'google/material-design-lite',
      stars: 32000,
      forks: 5200,
      open_prs: 45,
      open_issues: 123,
      contributors: 250,
      last_activity: '2024-12-20T14:45:00Z',
      language: 'CSS',
      html_url: 'https://github.com/google/material-design-lite',
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Issue Metrics Test Page</h1>
        <p className="text-muted-foreground">
          Test the new issue metrics and trends functionality for workspace analytics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="view-type">View Type</Label>
              <Select
                value={viewType}
                onValueChange={(value: 'single' | 'workspace') => setViewType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Repository</SelectItem>
                  <SelectItem value="workspace">Workspace (Mock)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">Repository Owner</Label>
              <Input
                id="owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. facebook"
                disabled={viewType === 'workspace'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo">Repository Name</Label>
              <Input
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. react"
                disabled={viewType === 'workspace'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-range">Time Range (days)</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowMetrics(true)} className="flex-1">
              Load Issue Metrics
            </Button>
            <Button variant="outline" onClick={() => setShowMetrics(false)} className="flex-1">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {showMetrics && (
        <div className="space-y-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">
              {viewType === 'single'
                ? `Issue Metrics for ${owner}/${repo}`
                : 'Workspace Issue Metrics (Mock Data)'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Time range: {timeRange} days • View: {viewType}
            </p>
          </div>

          {viewType === 'single' ? (
            <IssueMetricsAndTrendsCard owner={owner} repo={repo} timeRange={timeRange} />
          ) : (
            <WorkspaceIssueMetricsAndTrends
              repositories={mockRepositories}
              selectedRepositories={[]}
              timeRange={timeRange}
            />
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Popular Repositories to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { owner: 'facebook', repo: 'react' },
              { owner: 'microsoft', repo: 'vscode' },
              { owner: 'vercel', repo: 'next.js' },
              { owner: 'vuejs', repo: 'vue' },
              { owner: 'angular', repo: 'angular' },
              { owner: 'tensorflow', repo: 'tensorflow' },
            ].map(({ owner: testOwner, repo: testRepo }) => (
              <Button
                key={`${testOwner}/${testRepo}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  setOwner(testOwner);
                  setRepo(testRepo);
                  setViewType('single');
                }}
                className="text-xs"
              >
                {testOwner}/{testRepo}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p>This test page demonstrates the new issue metrics and trends functionality:</p>

            <h3>Issue Health Metrics</h3>
            <ul>
              <li>
                <strong>Stale vs Active Issues</strong>: Shows ratio of stale issues vs actively
                maintained ones
              </li>
              <li>
                <strong>Issue Half-life</strong>: Displays median time for issues to reach
                resolution
              </li>
              <li>
                <strong>Legitimate Bug Percentage</strong>: Shows percentage of issues labeled as
                actual bugs
              </li>
            </ul>

            <h3>Activity Pattern Metrics</h3>
            <ul>
              <li>
                <strong>Most Active Triager</strong>: Highlights contributor who triages the most
                issues
              </li>
              <li>
                <strong>First Human Responders</strong>: Tracks who provides initial responses most
                frequently
              </li>
              <li>
                <strong>Repeat Reporters</strong>: Identifies users who open the most issues
              </li>
            </ul>

            <h3>Issue Trends</h3>
            <ul>
              <li>Comparative analysis across time periods</li>
              <li>Trend indicators for issue resolution patterns</li>
              <li>Visual indicators for improvement or degradation</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
