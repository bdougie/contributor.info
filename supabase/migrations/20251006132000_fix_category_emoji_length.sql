-- Migration: Fix Category Emoji Length Constraint
-- Created: 2025-10-06
-- Issue: category_emoji VARCHAR(10) is too short for some GitHub emojis
--
-- Remove the 10-character limit as GitHub category emojis can be longer

ALTER TABLE discussions
  ALTER COLUMN category_emoji TYPE VARCHAR;

COMMENT ON COLUMN discussions.category_emoji IS 'GitHub category emoji - stored as VARCHAR without length limit';

-- Validation
DO $$
DECLARE
  emoji_type TEXT;
BEGIN
  SELECT data_type || COALESCE('(' || character_maximum_length || ')', '') INTO emoji_type
  FROM information_schema.columns
  WHERE table_name = 'discussions'
    AND column_name = 'category_emoji'
    AND table_schema = 'public';

  RAISE NOTICE '✅ Category emoji length constraint removed';
  RAISE NOTICE '   - discussions.category_emoji type: %', emoji_type;
END $$;
