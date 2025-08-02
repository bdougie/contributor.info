# Data Retention Policy - contributor.info GitHub App

## Overview

This document outlines how the contributor.info GitHub App collects, stores, processes, and automatically purges data to ensure privacy compliance and maintain user trust. Our commitment is to collect only the minimum data necessary to provide valuable insights while respecting user privacy.

## Data Collection Principles

### What We Collect
The contributor.info GitHub App collects and processes the following types of data:

**Repository Information:**
- Public repository metadata (name, description, stars, forks)
- File paths and directory structure
- Commit history and authorship information
- Pull request and issue metadata
- CODEOWNERS file contents

**Contributor Data:**
- GitHub usernames and public profile information
- Contribution statistics (commits, PRs, reviews)
- Activity patterns and expertise areas
- Response time metrics for reviews

**Content Analysis:**
- File content for generating embeddings (temporary)
- Issue and pull request descriptions for similarity matching
- Comments and review text for context analysis

### What We Don't Collect
- Private repository contents (unless explicitly granted access)
- Sensitive information (API keys, passwords, personal data)
- Email addresses or contact information
- Private communications between users
- Financial or billing information

## Purpose of Data Collection

All data collection serves one primary purpose: **celebrating and supporting open source contributors**. Specifically:

1. **Reviewer Suggestions**: Identify the most appropriate reviewers for pull requests
2. **Contributor Recognition**: Highlight contributor achievements and expertise
3. **Project Insights**: Provide valuable analytics about project health and activity
4. **Context Discovery**: Help contributors understand related work and potential conflicts
5. **Community Building**: Foster better collaboration within development teams

## Automatic Data Purging System

### 30-Day File Index Purging

**What Gets Purged:**
- File contributor mappings older than 30 days
- File content embeddings older than 30 days
- PR insight data older than 30 days

**Purging Schedule:**
- Automatic daily purge at 2:00 AM UTC
- Triggered by PostgreSQL cron job
- Executed via the `purge_old_file_data()` function

**Technical Implementation:**
```sql
-- Automatic purge triggers
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-old-file-data',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$SELECT purge_old_file_data();$$
);
```

### What Triggers Purging

Data is automatically purged based on these conditions:

**File Contributors:**
- Last commit timestamp older than 30 days
- Repository becomes inactive (no new commits for 90+ days)
- Repository is deleted or app is uninstalled

**File Embeddings:**
- Last indexed timestamp older than 30 days  
- File content hash changes significantly
- Repository access is revoked

**PR Insights:**
- Generated timestamp older than 30 days
- Associated pull request is closed for 30+ days

### Retention Periods

| Data Type | Retention Period | Purge Trigger |
|-----------|------------------|---------------|
| File contributor mappings | 30 days | Last commit date |
| File content embeddings | 30 days | Last indexed date |
| PR insights and analysis | 30 days | Generation date |
| Contributor statistics | 90 days (aggregated) | Last activity |
| Repository metadata | Until app uninstalled | Installation status |
| CODEOWNERS cache | 5 minutes | File modification |

## Data Security and Access

### Encryption and Storage
- **In Transit**: All data encrypted with TLS 1.3
- **At Rest**: Database encryption using AES-256
- **Backups**: Encrypted automated backups with 7-day retention
- **Access Logs**: All data access logged and monitored

### Access Controls
- **Principle of Least Privilege**: Staff access limited to necessary functions only
- **Role-Based Access**: Different permission levels for different functions
- **Audit Logging**: All administrative access logged and reviewed
- **Regular Reviews**: Access permissions reviewed quarterly

### Data Processing Locations
- **Primary**: United States (AWS US-East-1)
- **Backups**: United States (AWS US-West-2)
- **CDN**: Global distribution via CloudFlare
- **No International Transfers**: Data remains within US borders

## User Rights and Control

### Right to Access
Users can access their data through:
- **GitHub API**: View public contribution data
- **App Interface**: See processed insights and statistics
- **Data Export**: Request full data export (contact support)

### Right to Deletion
Users can request data deletion via:
- **App Uninstallation**: Stops new data collection immediately
- **Repository Removal**: Removes repository-specific data within 24 hours
- **Manual Request**: Contact support for immediate deletion
- **Account Deletion**: All associated data purged within 30 days

### Right to Opt-Out
Users can control app behavior using:
- **Configuration File**: Use `.contributor` file to disable features
- **Granular Control**: Enable/disable specific features per repository
- **User Exclusions**: Exclude specific users from processing
- **Repository Exclusions**: Exclude entire repositories from analysis

## Compliance and Legal

### GDPR Compliance
For users in the European Union:
- **Lawful Basis**: Legitimate interest in supporting open source development
- **Data Subject Rights**: Full access, portability, erasure, and rectification rights
- **Privacy by Design**: Data minimization and purpose limitation built-in
- **Breach Notification**: 72-hour notification for any security incidents

### CCPA Compliance  
For California residents:
- **Disclosure**: Full transparency about data collection and use
- **Opt-Out Rights**: Right to opt-out of data processing
- **Non-Discrimination**: No service penalties for exercising privacy rights
- **Deletion Rights**: Right to delete personal information

### SOC 2 Type II
Our infrastructure partners maintain:
- **Security**: Comprehensive security controls and monitoring
- **Availability**: 99.9% uptime SLA with redundancy
- **Processing Integrity**: Data accuracy and completeness controls
- **Confidentiality**: Information protection measures
- **Privacy**: Personal information handling controls

## Data Sharing and Third Parties

### We Never Share Data With:
- Advertising networks or marketing companies
- Data brokers or analytics resellers
- Social media platforms (beyond GitHub)
- Government agencies (except legal requirements)
- Third-party AI training datasets

### Limited Technical Partners:
- **GitHub**: Source of public repository data
- **OpenAI**: AI embeddings generation (no data retention on their side)
- **Supabase**: Database hosting and management
- **Vercel**: Application hosting and CDN

### Legal Disclosures:
We may disclose data only when:
- Required by valid legal process (subpoena, court order)
- Necessary to protect user safety or prevent fraud
- Required to defend our legal rights
- User provides explicit consent

## Monitoring and Transparency

### Purge Logging
All data purging activities are logged:

```sql
-- Sample purge log entry
INSERT INTO data_purge_log (
  purge_date,
  file_contributors_purged,
  file_embeddings_purged,
  pr_insights_purged
) VALUES (
  '2025-02-01 02:00:00+00',
  1247,  -- file contributor records purged
  892,   -- embedding records purged  
  445    -- PR insight records purged
);
```

### Regular Auditing
- **Monthly**: Review purge logs and data retention compliance
- **Quarterly**: Security access review and permission audit
- **Annually**: Comprehensive privacy impact assessment
- **Continuous**: Automated monitoring of data volumes and retention

### Transparency Reports
We publish annual transparency reports including:
- Total data processed and purged
- Legal requests received (if any)
- Security incidents and resolutions
- Policy changes and improvements

## User Notifications

### Policy Changes
Users are notified of policy changes via:
- **GitHub App Notifications**: Direct notifications to repository admins
- **Documentation Updates**: Clear changelog in documentation
- **Email Alerts**: For subscribers to our updates (optional)
- **30-Day Notice**: Major changes announced 30 days in advance

### Data Incidents
In case of security incidents:
- **Immediate**: Internal incident response activated within 1 hour
- **24 Hours**: Affected users notified if personal data involved
- **72 Hours**: Regulatory notifications if required by law
- **Follow-up**: Post-incident report and remediation steps

## Contact and Support

### Data Protection Officer
For privacy-related inquiries:
- **GitHub Issues**: [github.com/bdougie/contributor.info/issues](https://github.com/bdougie/contributor.info/issues)
- **Privacy Label**: Use "privacy" label for privacy-specific issues
- **Response Time**: Privacy inquiries answered within 72 hours

### Data Requests
For data access, deletion, or portability requests:
1. **Create GitHub Issue**: Use the privacy request template
2. **Provide Details**: Specify repositories and data types involved
3. **Verification**: We may request verification of repository ownership
4. **Processing**: Requests processed within 30 days

### Emergency Contacts
For urgent privacy or security concerns:
- **Security Issues**: Report via GitHub Security Advisories
- **Data Breaches**: Create critical issue with "security" label
- **Legal Matters**: Contact via GitHub issue with full details

## Future Enhancements

### Planned Improvements
- **Enhanced User Control**: More granular privacy settings per feature
- **Data Portability**: Better export formats and tools
- **Retention Customization**: Allow users to set custom retention periods
- **Real-time Deletion**: Instant data deletion upon request
- **Privacy Dashboard**: Self-service privacy management interface

### Technology Updates
- **Encryption**: Migrating to advanced encryption standards
- **Zero-Knowledge**: Exploring zero-knowledge proof systems
- **Differential Privacy**: Adding noise to protect individual privacy
- **Federated Learning**: Processing data without centralization

## Terms of Use Reference

This data retention policy works in conjunction with our [Terms of Use](/docs/terms-of-use-github-app.md). Key points:

- **Data Collection**: Limited to celebrating contributors and improving open source
- **Automatic Purging**: 30-day automatic data purging for file indexes
- **User Rights**: Full access, deletion, and opt-out rights
- **No Commercial Use**: Data never sold or used for advertising
- **Security**: Enterprise-grade security and encryption standards

For complete terms, please review our [GitHub App Terms of Use](/docs/terms-of-use-github-app.md).

---

**Last Updated**: February 2, 2025  
**Next Review**: August 2, 2025  
**Policy Version**: 2.1

*This policy is reviewed and updated regularly to ensure compliance with evolving privacy regulations and best practices.*