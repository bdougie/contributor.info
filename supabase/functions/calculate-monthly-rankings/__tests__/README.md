# Calculate Monthly Rankings Tests

This directory contains tests for the `calculate-monthly-rankings` Edge Function.

## Running Tests

To run the Deno tests for this Edge Function:

```bash
cd supabase/functions/calculate-monthly-rankings
deno test --allow-env __tests__/date-logic.test.ts
```

Or from the project root:

```bash
deno test --allow-env supabase/functions/calculate-monthly-rankings/__tests__/date-logic.test.ts
```

## Test Coverage

### `date-logic.test.ts`

Tests the date selection logic that determines which month's data to query based on the current
date:

- **Winner Announcement Phase (Days 1-7)**: Verifies that the function requests previous month's
  data
- **Running Leaderboard Phase (Days 8+)**: Verifies that the function requests current month's data
- **Explicit Parameters**: Tests that explicit month/year parameters override the automatic
  detection
- **Date Range Calculation**: Validates that date ranges are correctly calculated for each month
- **Edge Cases**: Tests year boundaries, leap years, and timezone handling

## Key Behaviors Tested

1. During days 1-7 of any month, the function should query the **previous** month's data (winner
   announcement)
2. During days 8+ of any month, the function should query the **current** month's data (running
   leaderboard)
3. When crossing year boundaries (e.g., January 1-7), it should correctly select December of the
   previous year
4. Explicit month/year parameters should always take precedence over automatic detection
5. Date ranges should correctly handle:
   - Regular months (28-31 days)
   - Leap years (February 29)
   - Year boundaries
   - UTC timezone consistency
