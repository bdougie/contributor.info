The **Repository Activity Feed** provides a real-time stream of pull request activity and contributor interactions within your repository. This chronological view helps you stay current with project developments and track team engagement patterns.

## Overview

The activity feed presents a timeline of repository events including pull request creations, merges, reviews, and contributor milestones. It serves as a project pulse that keeps maintainers and contributors informed about ongoing development activity.

## Feed Components

### Pull Request Timeline
![Pull request activity timeline](/docs/images/features/activity-feed/pr-timeline.png)
*Real-time feed of repository activity*

The feed displays PR events in reverse chronological order with key details:

- **PR Creation**: New pull requests with title, author, and creation timestamp
- **Merge Events**: Successfully merged PRs with merge time and reviewer information  
- **Review Activity**: Code review submissions, approvals, and change requests
- **Status Changes**: PR state transitions from draft to ready, or open to closed

### Contributor Highlights
Special feed items celebrate contributor achievements and milestones:

- **First-time Contributors**: Welcome messages for new project contributors
- **Contribution Streaks**: Recognition for contributors with consecutive PR activity
- **Review Milestones**: Acknowledgment of significant review activity
- **Top Performer Badges**: Monthly and weekly top contributor recognitions

## Time-Based Filtering

### Flexible Time Ranges
The feed adapts to your selected time range preferences:

- **30 Days**: Recent activity focus for daily project monitoring
- **60 Days**: Medium-term activity patterns for sprint planning
- **90 Days**: Long-term trends for quarterly reviews and retrospectives

### Real-Time Updates
The feed refreshes automatically to show the latest activity without requiring manual page reloads, ensuring you always have current information.

## Activity Insights

### Velocity Indicators
![Velocity metrics](/docs/images/features/activity-feed/velocity-indicators.png)
*Track development velocity and trends*

Each feed item includes context that helps assess project velocity:

- **PR Throughput**: Daily and weekly PR processing rates
- **Review Response Times**: How quickly PRs receive attention
- **Merge Success Rates**: Percentage of PRs that successfully merge
- **Contributor Engagement**: Number of active contributors in the time period

### Workflow Health Signals
The feed highlights patterns that indicate workflow health or potential issues:

- **Fast-Track Merges**: PRs that merge quickly, indicating efficient processes
- **Stale PRs**: PRs that remain open for extended periods
- **High Review Activity**: PRs generating significant discussion
- **Bot Activity**: Automated contributions and their impact on workflow

## Navigation and Interaction

### Direct PR Links
Each feed item includes direct links to the associated pull request on GitHub, enabling quick navigation from the activity overview to detailed PR information.

### Contributor Profiles
Clicking on contributor names provides access to their detailed profile and contribution history within the repository.

### Contextual Information
Feed items include relevant context such as file changes, commit counts, and affected areas of the codebase to help understand the scope of each contribution.

## Integration Benefits

### Project Monitoring
Maintainers can quickly scan the feed to understand current project status, identify contributions requiring attention, and track team productivity.

### Community Engagement
The feed helps foster community by celebrating contributions and making all team members' work visible and appreciated.

### Historical Context
The chronological format provides valuable historical context for understanding how the project has evolved and which contributors have been most active during specific periods.

The Repository Activity Feed transforms repository data into an engaging, informative stream that keeps all stakeholders connected to project progress and community activity.