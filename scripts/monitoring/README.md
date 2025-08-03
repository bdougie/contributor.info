# Monitoring Scripts

Cost analysis and performance monitoring tools for the contributor.info platform.

## Overview

These scripts help track system costs, analyze performance, and ensure optimal resource usage across both Inngest and GitHub Actions processing.

## Scripts

### `cost-analyzer.js`

**Purpose**: Track and analyze processing costs to validate expected savings from the hybrid approach.

**When to use**:
- Weekly cost reviews
- Validating the 60-85% cost reduction from hybrid processing
- Budget planning and optimization

**What it does**:
- Compares Inngest vs GitHub Actions costs
- Tracks cost trends over time
- Identifies optimization opportunities
- Validates expected cost savings

**Usage**:
```bash
node scripts/monitoring/cost-analyzer.js
```

**Output**: Detailed cost breakdown showing:
- Processing costs by type (Inngest vs GitHub Actions)
- Cost per repository and processing volume
- Savings achieved through hybrid approach
- Recommendations for further optimization

## Cost Models

The cost analyzer uses realistic pricing models:

| Service | Base Cost | Additional Factors |
|---------|-----------|-------------------|
| **Inngest** | $0.0001 per execution | Data processing, rate limits, concurrency |
| **GitHub Actions** | $0.008 per minute | Setup overhead, storage costs |

## Expected Savings

The hybrid approach should achieve:
- **60-85% cost reduction** compared to Inngest-only processing
- **Lower rate limit penalties** through distributed processing
- **Reduced concurrency costs** by using GitHub Actions for bulk operations

## Monitoring Workflow

1. **Run cost analysis weekly**:
   ```bash
   node scripts/monitoring/cost-analyzer.js
   ```

2. **Review cost trends** and identify any unexpected increases

3. **Validate savings targets** are being met

4. **Adjust processing strategies** if costs exceed expectations

## Integration

This monitoring integrates with:
- **Rollout system**: Cost tracking during feature rollouts
- **Database metrics**: Processing volumes and success rates
- **Performance monitoring**: Cost-per-operation analysis

## Safety Notes

- Cost analysis is **read-only** and safe to run anytime
- Requires Supabase access for metrics data
- No system changes or data modifications
- Helps identify cost optimization opportunities

Use this monitoring to ensure the hybrid processing system delivers expected cost savings while maintaining performance and reliability.