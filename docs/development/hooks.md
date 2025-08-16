# Custom React Hooks

This document provides an overview of all custom hooks available in the contributor.info application. These hooks encapsulate reusable logic for working with GitHub contribution data, time formatting, and UI state management.

## Table of Contents

- [GitHub API Hooks](#github-api-hooks)
  - [useGitHubApi](#usegithubapi)
  - [useGitHubAuth](#usegithubauth)
  - [useGitHubOrganizations](#usegithuborganizations)
  - [useRepositoryParser](#userepositoryparser)
  - [useRepoSearch](#usereposearch)
- [Contribution Analysis Hooks](#contribution-analysis-hooks)
  - [useContribution](#usecontribution)
  - [useContributorData](#usecontributordata)
  - [useDistribution](#usedistribution)
  - [usePRActivity](#usepractivity)
  - [useRepoData](#userepodata)
  - [useRepoStats](#userepostats)
- [Utility Hooks](#utility-hooks)
  - [useTimeFormatter](#usetimeformatter)
  - [useToast](#usetoast)

## GitHub API Hooks

### useGitHubApi

Provides methods for interacting with the GitHub API, handling authentication, and managing rate limits.

```tsx
import { useGitHubApi } from '@/hooks/use-github-api';

function MyComponent() {
  const { 
    fetchRepository, 
    fetchPullRequests, 
    fetchUser,
    isLoading, 
    error, 
    rateLimit 
  } = useGitHubApi();

  // Example: Fetch repository information
  const fetchRepoData = async () => {
    try {
      const repo = await fetchRepository('owner', 'repo-name');
      console.log(repo);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      <button onClick={fetchRepoData}>Fetch Repo</button>
    </div>
  );
}
```

### useGitHubAuth

Manages GitHub authentication state using Supabase.

### useGitHubOrganizations

Fetches and manages organization data for GitHub users.

### useRepositoryParser

Parses repository information from various formats (URL, owner/repo string).

### useRepoSearch

Provides search functionality for GitHub repositories.

## Contribution Analysis Hooks

### useContribution

Analyzes pull requests to categorize contributions into different quadrants (refinement, new features, refactoring, maintenance).

```tsx
import { useContribution } from '@/hooks/use-contribution';
import type { PullRequest } from '@/lib/types';

function ContributionAnalysis({ pullRequests }: { pullRequests: PullRequest[] }) {
  const { 
    distribution, 
    quadrantCounts,
    getTotalContributions 
  } = useContribution(pullRequests);

  return (
    <div>
      <h2>Contribution Analysis</h2>
      <p>Total Contributions: {getTotalContributions()}</p>
      <div>
        <h3>Distribution</h3>
        {distribution && (
          <ul>
            <li>New Features: {distribution.newStuff.toFixed(1)}%</li>
            <li>Refinement: {distribution.refinement.toFixed(1)}%</li>
            <li>Refactoring: {distribution.refactoring.toFixed(1)}%</li>
            <li>Maintenance: {distribution.maintenance.toFixed(1)}%</li>
          </ul>
        )}
      </div>
    </div>
  );
}
```

### useContributorData

Analyzes and processes contributor-specific data from pull requests.

### useDistribution

Calculates statistical distribution of contributions across different categories.

### usePRActivity

Tracks and analyzes pull request activity over time.

### useRepoData

Fetches and manages repository data, including pull requests and contributions.

### useRepoStats

Calculates and provides various statistics about a repository.

## Utility Hooks

### useTimeFormatter

Provides utility functions for formatting dates and times in various formats.

```tsx
import { useTimeFormatter } from '@/hooks/use-time-formatter';

function TimeDisplay({ date }: { date: string }) {
  const { 
    formatRelativeTime, 
    formatDate, 
    formatTime,
    formatDateRange,
    getTimeDifference
  } = useTimeFormatter();

  return (
    <div>
      <p>Relative: {formatRelativeTime(date)}</p>
      <p>Formatted date: {formatDate(date)}</p>
      <p>Formatted time: {formatTime(date)}</p>
      
      {/* Date range example */}
      <p>Date range: {formatDateRange('2023-01-01', '2023-01-15')}</p>
      
      {/* Time difference example */}
      <p>Time since: {getTimeDifference(date)}</p>
    </div>
  );
}
```

The useTimeFormatter hook provides the following functions:

- **formatRelativeTime(date)**: Formats a date as a relative time (e.g., "2 hours ago")
- **formatDate(date, options)**: Formats a date as a locale string with customizable options
- **formatTime(date, options)**: Formats a date as a time string with customizable options
- **formatDateRange(startDate, endDate)**: Formats a date range between two dates
- **getTimeDifference(startDate, endDate)**: Calculates the time difference between two dates

### useToast

Provides toast notification functionality for the application.