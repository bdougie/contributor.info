# LLM Citation Tracking System

A comprehensive system for tracking when contributor.info is cited by AI platforms and other sources.

## Features

### 🤖 Automated Referral Tracking
- Detects traffic from AI platforms (Claude, ChatGPT, Perplexity, Gemini, Copilot)
- Calculates citation confidence scores
- Tracks query patterns and repository-specific citations
- Real-time data collection via client-side tracking

### 📊 Analytics Dashboard
- Visual citation metrics and trends
- Platform-specific breakdowns
- Top cited repositories
- Citation confidence analysis
- Access at: `/admin/llm-citations`

### 🚨 Citation Monitoring
- Google Alerts integration (manual setup)
- Citation quality assessment
- Source tracking and categorization
- Weekly automated reporting

## System Architecture

### Database Tables
- `referral_traffic` - Client-side referral tracking
- `citation_alerts` - Manual citations from alerts/monitoring
- `query_patterns` - Common query patterns leading to citations
- `citation_metrics` - Daily aggregated metrics

### Client Integration
- Automatic initialization in `App.tsx`
- Real-time referrer analysis
- Session-based tracking
- Privacy-focused (no PII collection)

## Setup Instructions

### 1. Database Setup
The required tables are automatically created via migration:
```sql
-- Migration: create_llm_citation_tracking_tables
-- Already applied to your database
```

### 2. Client Tracking
Already integrated in the main application. No additional setup required.

### 3. Google Alerts Setup
Follow the manual setup guide:
```bash
cat scripts/citation-tracking/google-alerts-setup-guide.md
```

### 4. Weekly Reporting
Set up automated weekly reports:
```bash
# Run manually
node scripts/citation-tracking/weekly-citation-report.js

# Or schedule via cron (recommended)
# Add to your crontab:
# 0 9 * * 1 cd /path/to/contributor.info && node scripts/citation-tracking/weekly-citation-report.js
```

## Usage

### Viewing Analytics
1. Navigate to `/admin/llm-citations` (requires admin access)
2. View real-time citation metrics and trends
3. Analyze platform-specific performance
4. Monitor citation confidence scores

### Manual Citation Entry
For citations discovered via Google Alerts:
```sql
INSERT INTO citation_alerts (
  alert_source,
  content_snippet,
  source_url,
  source_domain,
  citation_type,
  confidence_score
) VALUES (
  'google_alerts',
  'Citation snippet here',
  'https://example.com/article',
  'example.com',
  'direct_link',
  0.9
);
```

### API Access
Use the LLM Citation Tracker directly:
```javascript
import { getLLMCitationTracker } from '@/lib/llm-citation-tracking';

const tracker = getLLMCitationTracker();
const metrics = await tracker.getCitationMetrics({
  start: new Date('2025-01-01'),
  end: new Date('2025-01-31')
});
```

## Key Metrics

### Citation Confidence Score
- **High (70%+)**: Direct AI platform referrals with clear citation context
- **Medium (40-69%)**: Likely citations with some uncertainty
- **Low (<40%)**: Possible citations requiring validation

### Platform Detection
Automatically detects referrals from:
- Claude/Anthropic
- ChatGPT/OpenAI
- Perplexity
- Google Gemini/Bard
- Microsoft Copilot
- Other AI platforms

### Query Pattern Analysis
Categorizes citations by query type:
- `contributor_lookup` - Finding specific contributors
- `repository_analysis` - Analyzing repositories
- `github_stats` - GitHub statistics queries
- `maintainer_info` - Maintainer information
- `project_insights` - General project insights

## Monitoring & Alerts

### Weekly Reports
Automated weekly reports include:
- Citation volume trends
- Platform performance
- Top cited repositories
- Query pattern analysis
- Confidence score distribution

### Manual Monitoring
- Set up Google Alerts for comprehensive coverage
- Monitor social media mentions
- Track academic/research citations
- Review developer blog references

## Privacy & Compliance

### Data Collection
- No personally identifiable information (PII) stored
- Session-based tracking only
- Referrer URLs and user agents collected for analysis
- Geographic data limited to country-level

### Data Retention
- Referral data retained for 1 year
- Aggregated metrics retained indefinitely
- Citation alerts retained for 2 years
- Query patterns retained indefinitely

## Troubleshooting

### No Citations Detected
1. Check if tables exist in database
2. Verify client-side tracking initialization
3. Test with known AI platform referrals
4. Review citation confidence scoring

### Low Citation Confidence
1. Review AI platform detection patterns
2. Check landing page analysis logic
3. Validate referrer URL parsing
4. Consider expanding detection algorithms

### Missing Data
1. Verify Supabase connection
2. Check RLS policies
3. Review client-side error logs
4. Validate database permissions

## Contributing

To enhance the citation tracking system:
1. Update AI platform detection in `llm-citation-tracking.ts`
2. Add new query patterns to the analysis
3. Improve confidence scoring algorithms
4. Extend the analytics dashboard
5. Add new citation sources

## Future Enhancements

- [ ] Automated Google Alerts processing
- [ ] Social media API integration
- [ ] Academic citation tracking
- [ ] Real-time citation notifications
- [ ] Citation quality scoring ML model
- [ ] API endpoints for external integrations
- [ ] Webhook support for third-party tools
- [ ] Advanced analytics and forecasting