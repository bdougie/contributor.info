import { useState } from 'react';
import { ContributorProfileModal } from './components/features/workspace/ContributorProfileModal';

// Test component to verify social links fetching
export function TestSocialLinks() {
  const [open, setOpen] = useState(true);

  // Create a test contributor with all required properties
  const testContributor: any = {
    id: 'test-123',
    username: 'bdougie', // Using a real GitHub username to test fetching
    avatar_url: 'https://avatars.githubusercontent.com/u/5713670',
    name: 'Brian Douglas',
    bio: 'Test bio',
    location: 'San Francisco',
    company: 'GitHub',
    twitter_username: 'bdougieYO',
    linkedin_url: null,
    discord_url: null,
    contributions_count: 100,
    prs_opened: 50,
    prs_merged: 45,
    issues_opened: 20,
    recent_activity_score: 85,
    activity_trend: 'up' as const,
    last_active: new Date().toISOString(),
    collaboration_score: 90,
    impact_score: 88,
    activity_score: 87,
    total_score: 88.3,
    groups: [],
    // Add stats object with contribution_trend
    stats: {
      contribution_trend: 'stable' as const,
      pr_velocity: 2.5,
      review_ratio: 0.8,
      total_contributions: 100,
      recent_contributions: 50,
    },
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Social Links Fetching</h1>
      <p className="mb-4">
        Click the button below to open the contributor profile modal and test the "Fetch from
        GitHub" button.
      </p>

      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Open Contributor Profile Modal
      </button>

      <ContributorProfileModal
        open={open}
        onOpenChange={setOpen}
        contributor={testContributor}
        groups={[]}
        contributorGroups={[]}
        notes={[]}
        workspaceId="test-workspace"
        isLoggedIn={false}
      />
    </div>
  );
}
