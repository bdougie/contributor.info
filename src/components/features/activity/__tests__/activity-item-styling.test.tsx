import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityItem } from '../activity-item'
import { RepoStatsContext } from '@/lib/repo-stats-context'
import type { PullRequestActivity } from '@/lib/types'

// Mock the dependencies
vi.mock('@/hooks/useContributorRoles', () => ({
  useContributorRole: () => ({ role: { role: 'Contributor' } })
}))

vi.mock('@/lib/contributor-utils', () => ({
  createContributorStats: () => ({
    name: 'test-user',
    avatar: 'https://github.com/test-user.png',
    id: 123,
    pullRequests: 5,
    mergedPullRequests: 3,
    totalContributions: 8
  }),
  createContributorStatsWithOrgs: () => Promise.resolve({
    name: 'test-user',
    avatar: 'https://github.com/test-user.png',
    id: 123,
    pullRequests: 5,
    mergedPullRequests: 3,
    totalContributions: 8
  })
}))

const mockActivity: PullRequestActivity = {
  id: 'activity-123',
  type: 'opened',
  user: {
    name: 'test-user',
    avatar: 'https://github.com/test-user.png',
    id: '123',
    isBot: false
  },
  pullRequest: {
    id: 'pr-123',
    number: 123,
    title: 'Test Pull Request',
    url: 'https://github.com/facebook/react/pull/123'
  },
  repository: {
    id: 'repo-facebook-react',
    owner: 'facebook',
    name: 'react',
    url: 'https://github.com/facebook/react'
  },
  timestamp: '2 days ago',
  createdAt: new Date()
}

const mockRepoStatsContext = {
  stats: {
    loading: false,
    error: null,
    pullRequests: [],
    contributors: [],
    reviews: [],
    comments: []
  },
  lotteryFactor: {
    score: 0,
    factors: [],
    topContributorsCount: 0,
    totalContributors: 0,
    topContributorsPercentage: 0,
    contributors: [],
    riskLevel: 'Low' as const
  },
  directCommitsData: {
    hasYoloCoders: false,
    yoloCoderStats: []
  },
  includeBots: false,
  setIncludeBots: vi.fn()
}

describe('ActivityItem Link Styling', () => {
  it('should render pull request link with orange color', () => {
    render(
      <RepoStatsContext.Provider value={mockRepoStatsContext}>
        <ActivityItem activity={mockActivity} />
      </RepoStatsContext.Provider>
    )

    const prLink = screen.getByRole('link', { name: '#123' })
    expect(prLink).toBeInTheDocument()
    expect(prLink).toHaveClass('text-orange-500')
    expect(prLink).toHaveClass('hover:underline')
    expect(prLink).toHaveAttribute('href', 'https://github.com/facebook/react/pull/123')
  })

  it('should render repository link with orange color', () => {
    render(
      <RepoStatsContext.Provider value={mockRepoStatsContext}>
        <ActivityItem activity={mockActivity} />
      </RepoStatsContext.Provider>
    )

    const repoLink = screen.getByRole('link', { name: 'facebook/react' })
    expect(repoLink).toBeInTheDocument()
    expect(repoLink).toHaveClass('text-orange-500')
    expect(repoLink).toHaveClass('hover:underline')
    expect(repoLink).toHaveAttribute('href', 'https://github.com/facebook/react')
  })

  it('should verify both links have consistent orange styling', () => {
    render(
      <RepoStatsContext.Provider value={mockRepoStatsContext}>
        <ActivityItem activity={mockActivity} />
      </RepoStatsContext.Provider>
    )

    const allLinks = screen.getAllByRole('link')
    const prLink = allLinks.find(link => link.textContent === '#123')
    const repoLink = allLinks.find(link => link.textContent === 'facebook/react')

    // Both links should have orange color
    expect(prLink).toHaveClass('text-orange-500')
    expect(repoLink).toHaveClass('text-orange-500')

    // Both links should have hover underline
    expect(prLink).toHaveClass('hover:underline')
    expect(repoLink).toHaveClass('hover:underline')

    // Both links should open in new tab
    expect(prLink).toHaveAttribute('target', '_blank')
    expect(repoLink).toHaveAttribute('target', '_blank')
    expect(prLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should verify repository link has additional styling classes', () => {
    render(
      <RepoStatsContext.Provider value={mockRepoStatsContext}>
        <ActivityItem activity={mockActivity} />
      </RepoStatsContext.Provider>
    )

    const repoLink = screen.getByRole('link', { name: 'facebook/react' })
    
    // Repository link should have truncation classes
    expect(repoLink).toHaveClass('truncate')
    expect(repoLink).toHaveClass('max-w-xs')
    expect(repoLink).toHaveClass('sm:max-w-none')
    
    // Should have title attribute for accessibility
    expect(repoLink).toHaveAttribute('title', 'facebook/react')
  })

  it('should verify the orange color is specifically text-orange-500', () => {
    const { container } = render(
      <RepoStatsContext.Provider value={mockRepoStatsContext}>
        <ActivityItem activity={mockActivity} />
      </RepoStatsContext.Provider>
    )

    // Check that text-orange-500 class is present in the DOM
    const orangeLinks = container.querySelectorAll('.text-orange-500')
    expect(orangeLinks).toHaveLength(2) // Both PR link and repo link

    // Verify no old primary color classes remain
    const primaryLinks = container.querySelectorAll('.text-primary')
    expect(primaryLinks).toHaveLength(0)
  })
})