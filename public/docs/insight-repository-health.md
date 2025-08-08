# Repository Health

The Repository Health insight provides comprehensive analysis of your repository's overall wellness, combining automated metrics with AI-powered assessments to give maintainers actionable health information.

## Overview

Repository health is evaluated through multiple dimensions:
- **Contribution patterns**: Diversity and distribution of contributors  
- **Review efficiency**: Time to review and merge pull requests
- **Activity trends**: Overall repository engagement and momentum
- **Risk factors**: Lottery factor and self-selection analysis

## Health Assessment

### AI-Powered Analysis
- **Health Score**: Overall repository wellness rating
- **Confidence Level**: Reliability of the AI assessment (High/Medium/Low)
- **Trend Analysis**: Historical health progression
- **Personalized Insights**: Context-aware recommendations

### Key Metrics Analyzed
- Average pull request merge time
- Contributor diversity and retention
- Review coverage and quality
- Code change patterns and velocity
- Issue resolution efficiency

## Health Indicators

### Lottery Factor
- Measures knowledge concentration risk
- Identifies contributors critical to project continuity
- Highlights areas where knowledge should be distributed
- Provides recommendations for risk mitigation

### Self-Selection Rates  
- Tracks contributor autonomy in task selection
- Measures organic contribution patterns
- Identifies healthy vs. assigned work distribution
- Bot activity inclusion/exclusion toggle

### Review Health
- Average time from PR creation to merge
- Review participation rates
- Approval patterns and bottlenecks
- Quality gate effectiveness

## Visual Indicators
![Repository health summary](/docs/images/insights/repository-health/summary-dashboard.png)
*Comprehensive health metrics dashboard*


Health status is displayed through:
- **Color-coded scores**: Green (healthy), Yellow (attention needed), Red (critical)
- **Progress bars**: Visual representation of health metrics
- **Trend arrows**: Direction of health changes over time
- **Confidence badges**: Reliability indicators for AI assessments

## Time Range Analysis

Health insights adapt to selected time ranges:
- **Real-time updates** based on current filter settings
- **Historical comparisons** to identify trends
- **Seasonal adjustments** for activity patterns
- **Baseline establishment** for meaningful comparisons

## Integration Features

- **GitHub synchronization**: Real-time data updates
- **Supabase persistence**: Historical health tracking
- **LLM analysis**: Advanced pattern recognition
- **Caching optimization**: Performance-optimized insights

*This documentation will be expanded with specific examples and configuration options.*