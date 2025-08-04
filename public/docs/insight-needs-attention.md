# Needs Attention

The Needs Attention insight identifies pull requests that require immediate action from maintainers or contributors. This automated analysis helps prioritize review efforts and prevents important PRs from being overlooked.

## Overview

The system analyzes open pull requests and assigns urgency levels based on multiple factors:
- **Critical**: PRs requiring immediate attention (red indicator)
- **High**: Important PRs that should be reviewed soon (orange indicator)  
- **Medium**: Standard PRs in the review queue (yellow indicator)
- **Low**: PRs with lower urgency (blue indicator)

## Scoring Factors

The urgency algorithm considers:
- **Age**: Days since PR creation or last update
- **Size**: Lines changed and files modified
- **Review Status**: Missing reviews or requested reviewers
- **Author**: First-time contributors receive higher priority
- **Draft Status**: Draft PRs receive lower urgency

## Information Displayed
![Needs attention scoring](/docs/images/insights/needs-attention/scoring-display.png)
*Visual scoring system for repository attention needs*


Each PR card shows:
- Pull request number and title
- Author name and avatar
- Days since creation/last update
- Size indicators (lines added/removed)
- Specific urgency reasons
- Direct link to GitHub PR

## Summary Metrics

The section header displays:
- Total count of PRs needing attention
- Breakdown by urgency level
- Average days open across all flagged PRs

## Best Practices

- Review critical and high-priority PRs first
- Pay special attention to first-time contributor PRs
- Consider the urgency reasons when prioritizing work
- Use the direct GitHub links for quick access

*This documentation will be expanded with specific examples and configuration options.*