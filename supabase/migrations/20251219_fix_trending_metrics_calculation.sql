-- Fix trending metrics calculation
-- Issue: https://github.com/bdougie/contributor.info/issues/1418
--
-- Problems fixed:
-- 1. capture_repository_metrics function wasn't setting previous_value correctly
-- 2. detect_significant_changes trigger was BEFORE INSERT but change_percentage is a generated column
--    (generated columns aren't computed until after the row is inserted)

-- Fix 1: Update capture_repository_metrics to properly set previous_value
-- Note: change_amount and change_percentage are generated columns, so we don't insert them directly
CREATE OR REPLACE FUNCTION capture_repository_metrics(
  p_repository_id UUID,
  p_metric_type TEXT,
  p_current_value INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_previous_value INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Validate input parameters
  IF p_repository_id IS NULL OR p_metric_type IS NULL OR p_current_value IS NULL THEN
    RAISE EXCEPTION 'All parameters are required for metrics capture';
  END IF;

  -- Check if repository exists
  SELECT EXISTS(SELECT 1 FROM repositories WHERE id = p_repository_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Repository with id % does not exist', p_repository_id;
  END IF;

  -- Get the most recent value for this metric
  SELECT current_value INTO v_previous_value
  FROM repository_metrics_history
  WHERE repository_id = p_repository_id
    AND metric_type = p_metric_type
  ORDER BY captured_at DESC
  LIMIT 1;

  -- Only insert if value has changed or this is the first capture
  IF v_previous_value IS NULL OR v_previous_value != p_current_value THEN
    -- Insert with previous_value set - change_amount and change_percentage are generated columns
    INSERT INTO repository_metrics_history (
      repository_id,
      metric_type,
      previous_value,
      current_value,
      captured_at
    ) VALUES (
      p_repository_id,
      p_metric_type,
      v_previous_value,
      p_current_value,
      NOW()
    );

    RETURN TRUE;
  END IF;

  RETURN FALSE; -- No change detected
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION capture_repository_metrics IS 'Captures repository metrics. Sets previous_value from last record so generated columns change_amount and change_percentage auto-calculate.';

-- Add composite index for efficient metrics lookup
-- This optimizes the query that finds the most recent metric value
CREATE INDEX IF NOT EXISTS idx_repository_metrics_lookup 
  ON repository_metrics_history (repository_id, metric_type, captured_at DESC);

-- Add 'contributor_drop' to allowed change_type values
-- This allows us to distinguish contributor decreases from increases
ALTER TABLE repository_changelogs DROP CONSTRAINT IF EXISTS repository_changelogs_change_type_check;
ALTER TABLE repository_changelogs ADD CONSTRAINT repository_changelogs_change_type_check 
  CHECK (change_type IN ('milestone', 'trending', 'activity_spike', 'contributor_surge', 'contributor_drop', 'release'));

-- Fix 2: Change trigger from BEFORE to AFTER INSERT
-- Generated columns (change_percentage) aren't computed until after the row is inserted
-- so we need an AFTER trigger that updates the row

-- Drop the old BEFORE trigger
DROP TRIGGER IF EXISTS detect_significant_changes ON repository_metrics_history;

-- Update function to work as AFTER trigger (uses UPDATE instead of modifying NEW)
CREATE OR REPLACE FUNCTION detect_significant_metric_change()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold DECIMAL := 5.0; -- 5% change threshold
  v_changelog_title TEXT;
  v_changelog_description TEXT;
  v_change_type TEXT;
  v_importance INTEGER;
BEGIN
  -- Mark as significant if change is > threshold (read from the inserted row)
  IF NEW.change_percentage IS NOT NULL AND ABS(NEW.change_percentage) > v_threshold THEN
    -- Update the row to mark it as significant
    UPDATE repository_metrics_history
    SET is_significant = TRUE
    WHERE id = NEW.id;

    -- Generate changelog entry for significant changes
    CASE NEW.metric_type
      WHEN 'stars' THEN
        v_changelog_title :=
          CASE
            WHEN NEW.change_percentage > 0 THEN 'Repository gained ' || NEW.change_amount || ' stars'
            ELSE 'Repository lost ' || ABS(NEW.change_amount) || ' stars'
          END;
        v_change_type := CASE WHEN NEW.change_percentage > 20 THEN 'trending' ELSE 'activity_spike' END;
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER * 2);

      WHEN 'contributors' THEN
        v_changelog_title :=
          CASE
            WHEN NEW.change_amount > 0 THEN NEW.change_amount || ' new contributors joined'
            ELSE ABS(NEW.change_amount) || ' contributors left'
          END;
        v_change_type := 
          CASE
            WHEN NEW.change_amount > 0 THEN 'contributor_surge'
            ELSE 'contributor_drop'
          END;
        v_importance := LEAST(100, ABS(NEW.change_amount) * 10);

      WHEN 'pull_requests' THEN
        v_changelog_title := 'PR activity ' ||
          CASE
            WHEN NEW.change_percentage > 0 THEN 'increased by ' || ROUND(NEW.change_percentage) || '%'
            ELSE 'decreased by ' || ROUND(ABS(NEW.change_percentage)) || '%'
          END;
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);

      ELSE
        v_changelog_title := NEW.metric_type || ' changed by ' || ROUND(NEW.change_percentage) || '%';
        v_change_type := 'activity_spike';
        v_importance := LEAST(100, ABS(NEW.change_percentage)::INTEGER);
    END CASE;

    v_changelog_description := 'Metric changed from ' || COALESCE(NEW.previous_value::TEXT, 'unknown') ||
                               ' to ' || NEW.current_value || ' (' ||
                               CASE
                                 WHEN NEW.change_percentage > 0 THEN '+'
                                 ELSE ''
                               END || ROUND(NEW.change_percentage) || '% change)';

    -- Insert changelog entry (ignore conflicts)
    INSERT INTO repository_changelogs (
      repository_id,
      title,
      description,
      change_type,
      metadata,
      importance_score
    ) VALUES (
      NEW.repository_id,
      v_changelog_title,
      v_changelog_description,
      v_change_type,
      jsonb_build_object(
        'metric_type', NEW.metric_type,
        'previous_value', NEW.previous_value,
        'current_value', NEW.current_value,
        'change_percentage', NEW.change_percentage
      ),
      v_importance
    ) ON CONFLICT (repository_id, title) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create AFTER trigger so generated columns are computed before we check them
CREATE TRIGGER detect_significant_changes
  AFTER INSERT ON repository_metrics_history
  FOR EACH ROW
  EXECUTE FUNCTION detect_significant_metric_change();

COMMENT ON FUNCTION detect_significant_metric_change IS 'Marks metrics as significant when change > 5%. Uses AFTER trigger since change_percentage is a generated column.';
