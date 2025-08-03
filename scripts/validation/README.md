# Validation Scripts

Data integrity and gap validation tools to ensure consistent, complete data across the hybrid processing system.

## Overview

Validation scripts ensure no data is lost, duplicated, or corrupted when processing GitHub repository data through both Inngest and GitHub Actions processors.

## Scripts

### `data-gap-validator.js`

**Purpose**: Validate data consistency and completeness across both processing systems.

**When to use**:
- After major data processing operations
- Weekly data integrity checks
- Investigating missing or incomplete data
- Before and after system changes

**What it validates**:
- **Temporal gaps**: No missing time periods in data collection
- **Data completeness**: All required fields are populated
- **Consistency**: Same data from different processors matches
- **Duplication**: No duplicate entries from overlapping processes

**Usage**:
```bash
# Validate specific repository
REPOSITORY_ID=123 node scripts/validation/data-gap-validator.js

# Validate all repositories
node scripts/validation/data-gap-validator.js --all

# Validate specific time range
REPOSITORY_ID=123 START_DATE="2024-01-01" END_DATE="2024-12-31" node scripts/validation/data-gap-validator.js
```

**Output**:
- Gap analysis report
- Data consistency score
- Missing data identification
- Recommendations for data recovery

## Validation Categories

### Temporal Validation
- **Gap Detection**: Identifies missing time periods in data collection
- **Overlap Analysis**: Ensures proper handoff between processors
- **Time Consistency**: Validates timestamps across different data sources
- **Coverage Analysis**: Confirms complete historical coverage

### Data Integrity Validation
- **Field Completeness**: All required fields are populated
- **Data Format**: Proper data types and formats
- **Relationship Integrity**: Foreign keys and references are valid
- **Business Logic**: Data follows expected business rules

### Consistency Validation
- **Cross-Processor**: Same data from Inngest and GitHub Actions matches
- **Source Verification**: Data matches GitHub API responses
- **Historical Accuracy**: Historical data remains unchanged
- **Real-time Sync**: Recent data matches live API data

### Duplication Validation
- **Primary Key Uniqueness**: No duplicate primary keys
- **Content Duplication**: Same content not stored multiple times
- **Cross-System Duplicates**: No duplicates between processors
- **Historical Preservation**: No accidental overwrites

## Validation Rules

### Temporal Rules
```javascript
{
  maxGapMinutes: 60,           // Max 1 hour gap between jobs
  overlapToleranceMinutes: 5,  // 5 minutes overlap allowed
  requiredCoverage: 0.95       // 95% time coverage required
}
```

### Data Rules
```javascript
{
  minDataPoints: 1,            // Minimum data per time period
  maxDuplicateRate: 0.05,      // Max 5% duplicates allowed
  requiredFields: ['id', 'created_at', 'repository_id']
}
```

### Consistency Rules
```javascript
{
  maxTimeDifference: 300000,   // 5 minutes max difference
  tolerancePercentage: 0.01,   // 1% variance allowed
  criticalFields: ['id', 'number', 'state']
}
```

## Validation Workflow

### Daily Validation
```bash
# Quick validation for recent data
node scripts/validation/data-gap-validator.js --recent

# Check critical repositories
node scripts/validation/data-gap-validator.js --critical-repos
```

### Weekly Deep Validation
```bash
# Comprehensive validation
node scripts/validation/data-gap-validator.js --all --deep

# Historical data verification
node scripts/validation/data-gap-validator.js --historical --from="30-days-ago"
```

### Issue Investigation
```bash
# Validate specific time range with issues
REPOSITORY_ID=123 START_DATE="2024-06-01" END_DATE="2024-06-07" node scripts/validation/data-gap-validator.js

# Cross-reference with processing logs
node scripts/monitoring/cost-analyzer.js --same-period
```

### Recovery Workflow
```bash
# 1. Identify gaps
node scripts/validation/data-gap-validator.js --repository=123

# 2. Fix gaps with progressive capture
REPOSITORY_ID=123 START_DATE="gap-start" node scripts/progressive-capture/capture-pr-details.js

# 3. Re-validate
node scripts/validation/data-gap-validator.js --repository=123 --verify-fix
```

## Environment Variables

```bash
# Required
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key

# Optional validation configuration
REPOSITORY_ID=123                    # Specific repository to validate
START_DATE="2024-01-01"             # Validation start date
END_DATE="2024-12-31"               # Validation end date
VALIDATION_DEPTH="standard"         # standard, deep, or quick
MAX_GAP_MINUTES=60                  # Maximum allowed gap
DUPLICATE_THRESHOLD=0.05            # Maximum duplicate percentage
```

## Validation Reports

### Gap Analysis Report
```
📊 Data Gap Analysis Report

Repository: owner/repo (ID: 123)
Time Range: 2024-01-01 to 2024-12-31
Validation Depth: Deep

✅ Temporal Coverage: 98.5% (Target: 95%)
✅ Data Completeness: 99.8% (Target: 95%)
⚠️  Consistency Score: 94.2% (Target: 95%)
✅ Duplication Rate: 1.2% (Target: <5%)

Identified Issues:
- 3 gaps in PR data (June 15-16, 2024)
- 12 missing review records (scattered)
- Consistency variance in comment timestamps

Recommendations:
1. Run progressive capture for June 15-16 gap
2. Backfill missing reviews with capture-pr-reviews.js
3. Investigate timestamp source differences
```

### Consistency Report
```
🔍 Data Consistency Validation

Cross-Processor Comparison:
- Inngest Records: 1,247
- GitHub Actions Records: 1,251
- Matching Records: 1,243 (99.7%)
- Discrepancies: 4 records

Field-Level Analysis:
✅ IDs: 100% match
✅ Timestamps: 99.9% match (within tolerance)
⚠️  Content: 94.1% match (investigate encoding differences)
✅ Relationships: 100% valid foreign keys

Action Required:
- Investigate 4 discrepant records
- Check content encoding consistency
```

## Integration

Validation integrates with:
- **Progressive Capture**: Identify what data needs re-processing
- **Monitoring**: Alert on validation failures
- **Rollout System**: Ensure new processors maintain data integrity
- **Testing**: Validate test scenarios match production

## Safety Notes

- **Read-only validation**: No data modification by default
- **Performance-aware**: Optimized queries for large datasets
- **Non-disruptive**: Safe to run during normal operations
- **Comprehensive logging**: Detailed audit trail of validation results

Use validation scripts regularly to ensure the hybrid processing system maintains perfect data integrity and completeness across all repositories and time periods.