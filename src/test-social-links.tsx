import { useState } from 'react';
import { ContributorProfileModal } from './components/features/workspace/ContributorProfileModal';
import type { Contributor } from './components/features/workspace/ContributorsList';

// Test component to verify social links fetching
export function TestSocialLinks() {
  const [open, setOpen] = useState(true);

  // Create a test contributor with all required properties
  const testContributor: Contributor = {
    id: 'test-123',
    username: 'bdougie', // Using a real GitHub username to test fetching
    avatar_url: 'https://avatars.githubusercontent.com/u/5713670',
    name: 'Brian Douglas',
    bio: 'Test bio',
    location: 'San Francisco',
    company: 'GitHub',
    linkedin_url: null,
    discord_url: null,
    contributions: {
      commits: 0,
      pull_requests: 50,
      issues: 20,
      reviews: 0,
      comments: 0,
    },
    stats: {
      total_contributions: 100,
      contribution_trend: 0,
      last_active: new Date().toISOString(),
      repositories_contributed: 0,
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
