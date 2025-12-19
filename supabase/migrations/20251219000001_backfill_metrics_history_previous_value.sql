-- Backfill repository_metrics_history with correct previous_value
--
-- The capture_repository_metrics function was not properly setting previous_value,
-- leaving existing records with NULL values. This migration backfills those records
-- so that the generated columns (change_amount, change_percentage) can calculate correctly.
--
-- Related: #1418, PR #1419

-- Backfill existing records with correct previous_value using LAG window function
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH ordered_metrics AS (
    SELECT
      id,
      repository_id,
      metric_type,
      current_value,
      captured_at,
      LAG(current_value) OVER (
        PARTITION BY repository_id, metric_type
        ORDER BY captured_at
      ) AS calculated_previous_value
    FROM repository_metrics_history
  )
  UPDATE repository_metrics_history rmh
  SET previous_value = om.calculated_previous_value
  FROM ordered_metrics om
  WHERE rmh.id = om.id
    AND rmh.previous_value IS NULL
    AND om.calculated_previous_value IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % repository_metrics_history records with previous_value', updated_count;
END $$;
