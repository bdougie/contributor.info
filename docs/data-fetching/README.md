# Data Fetching Documentation

This directory contains comprehensive documentation for the Smart Data Fetching system in contributor.info.

## Overview

The Smart Data Fetching system is a sophisticated data pipeline that ensures all GitHub repositories are accessible and usable, regardless of their size. It implements intelligent fetching strategies, progressive loading, and robust error handling.

## Documentation Structure

### 🎯 [Implementation Status](./implementation-status.md) **NEW**
Complete project status summary showing all 6 phases completed, success metrics achieved, and future opportunities.

### 🔧 [Hybrid Rollout Configuration](./hybrid-rollout-configuration.md) **NEW**
Complete guide to the hybrid data fetching rollout system:
- Current 25% rollout status and configuration
- Managing rollout with console commands
- Routing logic between Inngest and GitHub Actions
- Monitoring and scaling procedures

### 🐛 [Inngest Troubleshooting](./inngest-troubleshooting.md) **NEW**
Comprehensive troubleshooting guide for Inngest issues:
- Common problems and solutions
- Debugging tools and scripts
- Local vs production configuration
- Emergency procedures

### 📋 [Rollout Quick Reference](./rollout-quick-reference.md) **NEW**
Quick command reference for rollout management:
- Console commands cheat sheet
- Test commands and monitoring
- Emergency procedures
- Key metrics and targets

### 📋 [Phase 3 & 4 Summary](./PHASE3-PHASE4-SUMMARY.md)
Executive summary of the Smart Data Fetching implementation, covering both Phase 3 (Smart Data Fetching Logic) and Phase 4 (Background Capture Optimization).

### ⚙️ [GitHub Actions Workflows](./github-actions-workflows.md) **NEW**
User-friendly guide to the automated workflows:
- Sync Contributor Stats - Monthly rankings data collection
- Update PR Activity - Recent activity processing
- Manual trigger instructions
- Monitoring and troubleshooting

### 🏗️ [Architecture Guide](./smart-data-fetching.md)
Complete technical architecture including:
- Repository size classification system
- Fetch strategy engine
- Progressive data loading
- Hybrid API strategy (GraphQL/REST)
- Performance optimizations

### 🎯 [Database-First Smart Fetching](./database-first-smart-fetching.md) **NEW**
Comprehensive guide to the enhanced data fetching system:
- Smart database-first approach eliminates timeouts
- Automatic new repository detection and setup
- Enhanced user notifications and status communication
- DataStateIndicator component usage
- Error handling and resilience patterns

### 🚦 [Queue Management](./queue-management.md)
Deep dive into the queue management system:
- Queue prioritization algorithm
- Job lifecycle and status tracking
- Auto-retry mechanisms
- Processor selection logic
- Database schema

### 📊 [Monitoring Guide](./monitoring-capture-health.md)
Operational guide for monitoring system health:
- Using the Capture Health Monitor dashboard
- Understanding metrics and indicators
- Troubleshooting common issues
- Performance optimization tips

### 🔧 [Data Analysis Scripts](./data-analysis-scripts.md) **NEW**
Scripts for testing and improving review/comment data capture:
- Test review/comment data presence (`test-review-sync.mjs`)
- Backfill missing data for existing repositories (`backfill-reviews-comments.mjs`)
- When and how to use each script
- Troubleshooting data capture issues

## Quick Links

### For Developers
- [Repository Size Classification](./smart-data-fetching.md#repository-size-classification)
- [Fetch Strategies](./smart-data-fetching.md#fetch-strategy-engine)
- [Queue Priority Scoring](./queue-management.md#priority-scoring-algorithm)
- [API Integration](./queue-management.md#api-integration)

### For Operators
- [Dashboard Access](./monitoring-capture-health.md#accessing-the-monitor)
- [Health Indicators](./monitoring-capture-health.md#health-indicators)
- [Troubleshooting](./monitoring-capture-health.md#troubleshooting-steps)
- [Alert Configuration](./monitoring-capture-health.md#alerting-and-notifications)

## Key Features

### 🎯 Smart Repository Classification
- Automatic size detection (Small/Medium/Large/XL)
- Activity-based metrics
- Priority assignment

### ⚡ Optimized Fetching
- Size-appropriate strategies
- Progressive data loading
- No blocking or "protected" repositories

### 🔄 Robust Queue Management
- Priority-based processing
- Automatic retry with backoff
- Load balancing between processors

### 📈 Comprehensive Monitoring
- Real-time dashboard (`/dev/capture-monitor`)
- Performance metrics
- Health indicators
- Alert system

## System Metrics

### Performance Targets
- Initial data load: <3 seconds for all repositories
- Background capture success rate: >85% (95% with retries)
- Queue processing: High priority within 10 minutes

### Current Statistics
- ✅ 100% repository accessibility (all phases complete)
- ✅ 90% reduction in resource exhaustion errors
- ✅ 85%+ background capture success rate (95% with retries)
- ✅ All 6 implementation phases completed January 2025
- ✅ Enhanced review/comment capture (up to 50 PRs per sync, previously 10)

## Getting Started

1. **For Project Overview**: Start with [Implementation Status](./implementation-status.md) 
2. **For New Contributors**: Review the [Phase 3 & 4 Summary](./PHASE3-PHASE4-SUMMARY.md)
3. **For Implementation Details**: Study the [Architecture Guide](./smart-data-fetching.md)
4. **For Operations**: Check the [Monitoring Guide](./monitoring-capture-health.md)

## Related Documentation

- [Progressive Capture System](/docs/progressive-capture/)
- [API Documentation](/docs/api/)
- [Database Schema](/supabase/migrations/)
- [User Experience Guidelines](/docs/user-experience/)