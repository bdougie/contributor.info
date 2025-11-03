# Confidence Tracking Tests

This directory contains tests for the confidence tracking system.

## Test Types

### Unit Tests
- **File**: `confidence-trend.test.ts`
- **Purpose**: Tests trend calculation logic with mocked data
- **Run**: `npm test confidence-trend.test.ts`
- **Status**: ✅ Always runs in CI

### Integration Tests
- **File**: `confidence-history.integration.test.ts`
- **Purpose**: Tests actual Supabase database operations
- **Run**: `npm test confidence-history.integration.test.ts`
- **Status**: ⚠️ Skipped in CI, requires credentials

## Running Integration Tests Locally

Integration tests are skipped by default in CI and when Supabase credentials are not available.

To run them locally:

1. **Set environment variables**:
   ```bash
   export VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
   export VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. **Run the tests**:
   ```bash
   npm test src/lib/insights/__tests__/confidence-history.integration.test.ts
   ```

## Why Skip Integration Tests in CI?

Integration tests require:
- Network access to Supabase
- Valid authentication credentials
- Write access to test database tables

These requirements make them unsuitable for CI environments where:
- Network may be restricted
- Credentials should not be exposed
- Database writes could conflict with production data

## Test Coverage

### Unit Tests Cover:
- ✅ Trend direction classification (improving, declining, stable)
- ✅ Percentage change calculations
- ✅ Threshold logic (5% stable zone)
- ✅ Edge cases (zero scores, identical scores, small changes)

### Integration Tests Cover:
- ✅ Saving confidence scores to database
- ✅ Input validation (score range, time range, required fields)
- ✅ Fetching historical data with proper ordering
- ✅ Trend calculation with real data
- ✅ Latest score retrieval
- ✅ Empty repository handling

## Manual Testing

For comprehensive validation, run integration tests locally before merging:

```bash
# Export credentials (get from .env file)
export VITE_SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2)
export VITE_SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)

# Run integration tests
npm test src/lib/insights/__tests__/confidence-history.integration.test.ts

# Clean up
unset VITE_SUPABASE_URL
unset VITE_SUPABASE_ANON_KEY
```

## CI Configuration

Integration tests automatically skip when:
- `CI=true` environment variable is set
- `VITE_SUPABASE_ANON_KEY` is empty or not set

This ensures CI builds pass without requiring database credentials.
