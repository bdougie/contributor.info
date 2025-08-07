# Google Alerts Setup for LLM Citation Tracking

This guide walks through setting up Google Alerts to monitor when contributor.info is mentioned or cited across the web, particularly by AI platforms.

## Required Google Alerts

Set up these alerts by visiting [Google Alerts](https://www.google.com/alerts):

### 1. Direct Site Mentions
- **Query**: `"contributor.info"`
- **Sources**: Automatic
- **Language**: English
- **Region**: Any region
- **How often**: As-it-happens
- **How many**: All results
- **Deliver to**: Your monitoring email

### 2. AI Platform Citations
- **Query**: `"contributor.info" (ChatGPT OR Claude OR Perplexity OR Gemini OR "AI assistant")`
- **Sources**: Web
- **Language**: English
- **Region**: Any region
- **How often**: As-it-happens
- **How many**: All results
- **Deliver to**: Your monitoring email

### 3. GitHub Analytics Context
- **Query**: `"contributor.info" ("GitHub analytics" OR "repository insights" OR "contributor analysis")`
- **Sources**: Web
- **Language**: English
- **Region**: Any region
- **How often**: Once a day
- **How many**: Best results
- **Deliver to**: Your monitoring email

### 4. Tool Recommendations
- **Query**: `"contributor.info" ("recommended tool" OR "useful for" OR "helps with" OR "great for")`
- **Sources**: Web
- **Language**: English
- **Region**: Any region
- **How often**: Once a day
- **How many**: Best results
- **Deliver to**: Your monitoring email

### 5. Social Media Mentions
- **Query**: `"contributor.info" site:twitter.com OR site:reddit.com OR site:hackernews.com`
- **Sources**: Web
- **Language**: English
- **Region**: Any region
- **How often**: Once a day
- **How many**: Best results
- **Deliver to**: Your monitoring email

## Processing Google Alerts

### Manual Processing
1. Check alerts daily
2. For each alert:
   - Assess citation quality (direct link, data reference, tool recommendation)
   - Note the platform/source
   - Record if it's from an AI platform response
   - Log in the citation tracking system at `/admin/llm-citations`

### Semi-Automated Processing (Future Enhancement)
Consider setting up:
- Email forwarding to a dedicated inbox
- Webhook processing for alert emails
- Automated citation quality scoring
- Integration with the existing citation tracking system

## Alert Management Best Practices

### Monitoring
- Review alerts weekly for pattern changes
- Adjust queries based on new citation patterns discovered
- Monitor for false positives and refine queries

### Quality Assessment
Rate each citation on:
- **Source Quality**: Academic, professional blog, AI platform, social media
- **Citation Type**: Direct link, data reference, methodology mention, tool recommendation
- **Context**: Problem-solving, research, recommendation, comparison

### Reporting
- Weekly summary of citation trends
- Monthly analysis of citation quality and sources
- Quarterly review of alert effectiveness

## Integration with LLM Citation Dashboard

To manually add citations from Google Alerts to the tracking system:

1. Navigate to `/admin/llm-citations` in the admin panel
2. Use the manual citation entry feature (when implemented)
3. Or directly add to the `citation_alerts` table in Supabase:

```sql
INSERT INTO citation_alerts (
  alert_source,
  content_snippet,
  source_url,
  source_domain,
  citation_type,
  confidence_score,
  metadata
) VALUES (
  'google_alerts',
  'Your content snippet here',
  'https://source-url.com',
  'source-url.com',
  'direct_link',
  0.8,
  '{"context": "tool_recommendation", "platform": "blog"}'::jsonb
);
```

## Expected Citation Patterns

Based on the nature of contributor.info, expect citations in:

- **Developer blogs**: Tool recommendations and tutorials
- **AI responses**: Data source for GitHub analytics questions
- **Research papers**: Methodology references for OSS analysis
- **Social media**: Tool sharing and recommendations
- **Documentation**: References in development workflows

## Measuring Success

Track these metrics:
- Citation volume trends over time
- Quality distribution (direct links vs. mentions)
- Platform diversity (AI platforms, blogs, social media)
- Repository-specific citation patterns
- User engagement following citations

---

*This manual setup is required because Google Alerts doesn't provide a public API for automated configuration. The citation tracking system will automatically capture referral traffic when users click links from AI platforms.*