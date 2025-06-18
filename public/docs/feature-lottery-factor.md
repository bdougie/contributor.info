The **Lottery Factor** is a critical metric for assessing the health and sustainability of your repository. It measures the risk associated with knowledge concentration among your contributors.

## What is the Lottery Factor?

The Lottery Factor represents the percentage of contributions made by your most active contributors. It's named after the concept: "How many people would need to be hit by a bus (or win the lottery) before the project becomes unmaintainable?"

## Understanding the Metrics

### Risk Levels

- **🟢 Low Risk**: Contributions are well-distributed across many contributors
- **🟡 Medium Risk**: Moderate concentration of contributions among top contributors
- **🔴 High Risk**: Heavy reliance on a few key contributors

### Key Components

1. **Top Contributors Percentage**: Shows what percentage of contributions come from your most active contributors
2. **Distribution Chart**: Visual representation of contribution distribution
3. **Contributor Breakdown**: Detailed view of individual contributor statistics

## Interpreting the Results

### Healthy Distribution (Low Risk)
- Top 5 contributors make up less than 60% of total contributions
- Multiple contributors with significant involvement
- Reduced bus factor risk

### Concerning Patterns (High Risk)
- Top 2-3 contributors make up more than 80% of contributions
- Heavy reliance on single maintainer
- Knowledge silos and succession planning concerns

## YOLO Coders Feature

When enabled, the **YOLO Coders** section identifies contributors who push commits directly to the main branch without going through pull requests.

### What it Shows
- Contributors bypassing the PR process
- Direct commit counts to main branch
- Potential process compliance issues

### Why it Matters
- Identifies workflow adherence
- Highlights potential security concerns
- Shows code review bypass patterns

## Actionable Insights

### For High Risk Repositories
1. **Encourage New Contributors**: Implement beginner-friendly issues
2. **Knowledge Sharing**: Organize code review sessions and documentation
3. **Mentorship Programs**: Pair experienced contributors with newcomers
4. **Process Improvements**: Establish clear contribution guidelines

### For Well-Distributed Repositories
1. **Maintain Engagement**: Keep contributor momentum going
2. **Recognize Contributors**: Celebrate diverse contributions
3. **Scale Processes**: Ensure your processes can handle growth

## Technical Details

The Lottery Factor is calculated based on:
- Pull request activity within the selected time range
- Merged contributions only (draft and closed PRs are excluded)
- Configurable time periods (30, 60, 90 days)
- Bot contributions can be included or excluded

## Best Practices

1. **Regular Monitoring**: Check your Lottery Factor monthly
2. **Trend Analysis**: Compare across different time periods
3. **Combine with Other Metrics**: Use alongside PR activity and distribution charts
4. **Action Planning**: Develop strategies based on your risk level

The Lottery Factor helps you understand not just who is contributing, but how sustainable your project's current contributor model is for long-term success.