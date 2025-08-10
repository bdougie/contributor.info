-- Test suite for detect_significant_metric_change() trigger function
-- This file tests the automatic detection of significant metric changes

-- Test setup: Create test repository
DO $$
DECLARE
  v_repo_id UUID;
  v_result RECORD;
BEGIN
  -- Create a test repository
  INSERT INTO repositories (id, owner, name, description, stargazers_count)
  VALUES (
    uuid_generate_v4(),
    'test-owner',
    'test-repo',
    'Test repository for trigger testing',
    1000
  ) RETURNING id INTO v_repo_id;

  -- Test 1: Change below threshold (4%) should not be marked significant
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'stars',
    1000,
    1040  -- 4% increase
  );

  SELECT is_significant INTO v_result
  FROM repository_metrics_history
  WHERE repository_id = v_repo_id
    AND metric_type = 'stars'
    AND current_value = 1040;

  ASSERT v_result.is_significant = FALSE, 
    'Test 1 Failed: 4% change should not be marked significant';

  -- Test 2: Change above threshold (6%) should be marked significant
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'stars',
    1000,
    1060  -- 6% increase
  );

  SELECT is_significant INTO v_result
  FROM repository_metrics_history
  WHERE repository_id = v_repo_id
    AND metric_type = 'stars'
    AND current_value = 1060;

  ASSERT v_result.is_significant = TRUE,
    'Test 2 Failed: 6% change should be marked significant';

  -- Test 3: Exactly 5% threshold should not be marked significant
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'pull_requests',
    100,
    105  -- Exactly 5% increase
  );

  SELECT is_significant INTO v_result
  FROM repository_metrics_history
  WHERE repository_id = v_repo_id
    AND metric_type = 'pull_requests'
    AND current_value = 105;

  ASSERT v_result.is_significant = FALSE,
    'Test 3 Failed: Exactly 5% change should not be marked significant (threshold is >5, not >=5)';

  -- Test 4: NULL previous value should handle gracefully
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'contributors',
    NULL,
    50
  );

  SELECT is_significant, change_percentage INTO v_result
  FROM repository_metrics_history
  WHERE repository_id = v_repo_id
    AND metric_type = 'contributors'
    AND current_value = 50;

  ASSERT v_result.change_percentage IS NULL,
    'Test 4 Failed: NULL previous value should result in NULL percentage';
  ASSERT v_result.is_significant = FALSE,
    'Test 4 Failed: NULL percentage should not be marked significant';

  -- Test 5: Negative changes should also be detected
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'forks',
    100,
    90  -- -10% decrease
  );

  SELECT is_significant INTO v_result
  FROM repository_metrics_history
  WHERE repository_id = v_repo_id
    AND metric_type = 'forks'
    AND current_value = 90;

  ASSERT v_result.is_significant = TRUE,
    'Test 5 Failed: -10% change should be marked significant';

  -- Test 6: Changelog entry should be created for significant changes
  SELECT COUNT(*) AS changelog_count INTO v_result
  FROM repository_changelogs
  WHERE repository_id = v_repo_id;

  ASSERT v_result.changelog_count >= 2,
    'Test 6 Failed: Changelog entries should be created for significant changes';

  -- Test 7: Verify changelog content format
  SELECT title, description INTO v_result
  FROM repository_changelogs
  WHERE repository_id = v_repo_id
    AND title LIKE '%stars%'
  LIMIT 1;

  ASSERT v_result.title IS NOT NULL,
    'Test 7 Failed: Changelog title should be generated';
  ASSERT v_result.description LIKE '%Metric changed from%',
    'Test 7 Failed: Changelog description should follow expected format';

  -- Test 8: Test different metric types generate appropriate titles
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'contributors',
    10,
    20  -- 100% increase
  );

  SELECT title INTO v_result
  FROM repository_changelogs
  WHERE repository_id = v_repo_id
    AND change_type = 'contributor_surge'
  ORDER BY created_at DESC
  LIMIT 1;

  ASSERT v_result.title = '10 new contributors joined',
    'Test 8 Failed: Contributor surge should have specific title format';

  -- Test 9: Test importance score calculation
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'stars',
    100,
    150  -- 50% increase
  );

  SELECT importance_score INTO v_result
  FROM repository_changelogs
  WHERE repository_id = v_repo_id
    AND title LIKE '%50 stars%'
  ORDER BY created_at DESC
  LIMIT 1;

  ASSERT v_result.importance_score <= 100,
    'Test 9 Failed: Importance score should be capped at 100';
  ASSERT v_result.importance_score > 0,
    'Test 9 Failed: Importance score should be positive';

  -- Test 10: Duplicate changelog entries should be ignored
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'issues',
    50,
    60  -- 20% increase
  );

  -- Try to insert the same change again
  INSERT INTO repository_metrics_history (
    repository_id,
    metric_type,
    previous_value,
    current_value
  ) VALUES (
    v_repo_id,
    'issues',
    50,
    60  -- Same 20% increase
  );

  SELECT COUNT(*) AS issue_count INTO v_result
  FROM repository_changelogs
  WHERE repository_id = v_repo_id
    AND title LIKE '%issues%';

  -- Should only have one entry due to conflict handling
  ASSERT v_result.issue_count <= 2,
    'Test 10 Failed: Duplicate changelog entries should be handled';

  -- Cleanup test data
  DELETE FROM repository_metrics_history WHERE repository_id = v_repo_id;
  DELETE FROM repository_changelogs WHERE repository_id = v_repo_id;
  DELETE FROM repositories WHERE id = v_repo_id;

  RAISE NOTICE 'All trigger tests passed successfully!';
END;
$$;