The **PR Activity** insight provides real-time monitoring of your repository's pull request patterns, team velocity, and development workflow health.

## Overview

This feature tracks pull request lifecycle metrics to help you understand:
- Development velocity and throughput
- Review and merge times
- Contributor activity patterns
- Workflow efficiency indicators

## Key Metrics

### Open Pull Requests
- **Current Open PRs**: Active pull requests awaiting review or merge
- **Total PRs**: Complete count including merged and closed PRs
- **Ratio Analysis**: Helps identify bottlenecks in the review process

### Average Merge Time
- **Time to Merge**: Average duration from PR creation to merge
- **Trend Indicators**: 
  - 🟢 **Decreasing**: Improving workflow efficiency
  - 🔴 **Increasing**: Potential bottlenecks developing
  - ⚪ **Stable**: Consistent workflow performance

### Color-Coded Performance
![PR activity metrics](/docs/images/insights/pr-activity/metrics-dashboard.png)
*Key pull request metrics at a glance*

- **🟢 Green (≤24 hours)**: Excellent responsiveness
- **🟡 Yellow (24-72 hours)**: Good performance
- **🔴 Red (>72 hours)**: Needs attention

## Weekly Velocity Tracking

### Current Week vs. Previous Week
- **PR Throughput**: Number of PRs processed
- **Progress Comparison**: Visual progress bar comparison
- **Percentage Change**: Quantified improvement or decline

### Velocity Insights
![Weekly velocity comparison](/docs/images/insights/pr-activity/weekly-velocity.png)
*Compare current week to previous week*

- **Increasing Velocity**: Team is accelerating development
- **Stable Velocity**: Consistent team performance
- **Decreasing Velocity**: May indicate bottlenecks or capacity issues

## Active Contributors

### Top Contributors This Period
- **Contributor Rankings**: Most active PR authors
- **Contribution Counts**: Number of PRs per contributor
- **Team Engagement**: Overall contributor diversity

### Engagement Patterns
- **New Contributors**: Fresh contributors to the project
- **Regular Contributors**: Consistent team members
- **Occasional Contributors**: Sporadic but valuable contributions

## Interpreting the Data

### Healthy Patterns
- **Fast Merge Times**: Sub-24 hour average merge times
- **Consistent Velocity**: Steady week-over-week PR processing
- **Active Contributor Base**: Multiple contributors with regular activity
- **Balanced Workload**: No single contributor dominating PR creation

### Warning Signs
- **Increasing Merge Times**: Growing review delays
- **Declining Velocity**: Decreasing PR throughput
- **Contributor Concentration**: Over-reliance on few contributors
- **Stagnant Open PRs**: Growing backlog of unreviewed PRs

## Actionable Recommendations

### For Fast-Moving Teams
1. **Maintain Quality**: Ensure speed doesn't compromise code quality
2. **Scale Processes**: Prepare for increased throughput
3. **Onboard Contributors**: Leverage momentum to grow the team

### For Slow-Moving Teams
1. **Identify Bottlenecks**: Find review or approval delays
2. **Streamline Processes**: Simplify PR workflows
3. **Increase Reviewer Capacity**: Add more reviewers or adjust availability

### For Growing Teams
1. **Establish Guidelines**: Create clear PR and review standards
2. **Mentorship**: Pair new contributors with experienced reviewers
3. **Tool Integration**: Use automation to assist with routine tasks

## Integration with Other Features

### Combine with Lottery Factor
- Cross-reference contributor activity with distribution
- Identify key contributors and their PR patterns
- Plan for succession and knowledge transfer

### Use with Distribution Charts
- Understand language-specific PR patterns
- Identify areas of high activity and potential expertise gaps

## Time Range Analysis

The PR Activity insights adapt to your selected time range:
- **30 days**: Recent activity patterns
- **60 days**: Medium-term trends
- **90 days**: Long-term velocity analysis

## Technical Implementation

### Data Sources
- GitHub Pull Request API
- Merge and close timestamps
- Contributor metadata
- Review and approval events

### Update Frequency
- **Real-time**: Live updates as PR events occur
- **Cached Results**: Optimized for performance
- **Historical Data**: Trend analysis over time

## Best Practices

1. **Daily Monitoring**: Check PR activity as part of daily standup
2. **Weekly Reviews**: Analyze velocity trends weekly
3. **Monthly Planning**: Use data for sprint and capacity planning
4. **Quarterly Analysis**: Long-term trend evaluation for team health

The PR Activity insights help you maintain a healthy development workflow by providing visibility into your team's pull request patterns and identifying opportunities for improvement.